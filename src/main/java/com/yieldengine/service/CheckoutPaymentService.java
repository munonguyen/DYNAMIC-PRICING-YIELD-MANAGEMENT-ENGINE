package com.yieldengine.service;

import com.yieldengine.config.VietQrProperties;
import com.yieldengine.entity.Payment;
import com.yieldengine.enums.VnPayTransactionStatus;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.record.ops.BookingPaymentStatus;
import com.yieldengine.record.ops.BookingPaymentStatus.PaymentQr;
import com.yieldengine.record.ops.BookingPaymentStatus.BankTransfer;
import com.yieldengine.record.ops.BookingPaymentStatus.State;
import com.yieldengine.repository.PaymentRepository;
import com.yieldengine.repository.ReservationRepository;
import com.yieldengine.repository.VnPayTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.ArrayList;

@Service
@RequiredArgsConstructor
public class CheckoutPaymentService {
    private final ReservationRepository reservations;
    private final PaymentRepository payments;
    private final VnPayTransactionRepository vnPayTransactions;
    private final MoMoPaymentGatewayService moMo;
    private final VnPayPaymentService vnPay;
    private final VietQrProperties vietQr;
    private final VietQrTransferService vietQrTransfers;
    private final VietQrBalanceService balances;

    public List<String> configuredProviders() {
        var providers = new ArrayList<String>();
        if (vietQr.isConfigured()) providers.add(VietQrTransferService.PROVIDER);
        if (moMo.isConfigured()) providers.add("MOMO_WALLET");
        if (vnPay.isConfigured()) providers.add("VNPAY_ESCROW");
        return providers;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public BookingPaymentStatus getStatus(UUID reservationId, UUID userId) {
        var reservation = reservations.findByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt sân."));
        BookingOrchestratorService.requireOwner(reservation, userId);
        String bookingStatus = reservation.getStatus();
        UUID bookingId = reservation.getBookingId();
        var paid = payments.findFirstByBookingIdAndGatewayVerifiedAtIsNotNullAndPaymentTypeNotAndStatusOrderByGatewayVerifiedAtDesc(
                bookingId, "REFUND", "SUCCESS");
        if (paid.isPresent() && List.of("CONFIRMED", "COMPLETED").contains(bookingStatus)) {
            Payment receipt = paid.get();
            long collected = payments.sumSuccessfulPaidByBookingId(bookingId);
            long remaining = Math.max(0, reservation.getLockedPrice() - collected);
            return new BookingPaymentStatus(reservationId, bookingStatus, State.VERIFIED, collected,
                    remaining, null, receipt.getProvider(), receipt.getProviderRef(), receipt.getGatewayVerifiedAt(),
                    null, balances.status(reservation, remaining));
        }
        var review = payments.findFirstByBookingIdAndGatewayVerifiedAtIsNotNullAndPaymentTypeNotAndStatusOrderByGatewayVerifiedAtDesc(
                bookingId, "REFUND", "REVIEW_REQUIRED");

        if ("CANCELLED".equals(bookingStatus) && review.isEmpty()) {
            var refund = payments.findByProviderAndProviderRef("PLATFORM_REFUND", "REFUND_" + reservationId);
            State cancelledState = refund.map(record -> {
                if ("PENDING".equals(record.getStatus())) {
                    return State.REFUND_PENDING;
                }
                return "SUCCESS".equals(record.getStatus()) && record.getGatewayVerifiedAt() != null
                        ? State.REFUNDED : State.REVIEW_REQUIRED;
            }).orElse(reservation.getRefundAmount() != null && reservation.getRefundAmount() > 0
                    ? State.REVIEW_REQUIRED : State.CANCELLED);
            return new BookingPaymentStatus(reservationId, bookingStatus, cancelledState,
                    paid.isPresent() ? payments.sumSuccessfulPaidByBookingId(bookingId) : 0, 0, null,
                    paid.map(Payment::getProvider).orElse(null), paid.map(Payment::getProviderRef).orElse(null),
                    refund.map(Payment::getGatewayVerifiedAt).orElse(null), null);
        }

        if (review.isPresent() || paid.isPresent()) {
            Payment payment = review.orElseGet(paid::orElseThrow);
            return new BookingPaymentStatus(reservationId, bookingStatus, State.REVIEW_REQUIRED, payment.getAmount(),
                    reservation.getLockedPrice(), null, payment.getProvider(), payment.getProviderRef(), payment.getGatewayVerifiedAt(), null);
        }
        Instant holdUntil = reservation.getHoldExpiresAt();
        if (holdUntil != null && reservation.getSlotStart().isBefore(holdUntil)) {
            holdUntil = reservation.getSlotStart();
        }
        State state;
        if ("CONFIRMED".equals(bookingStatus) || "COMPLETED".equals(bookingStatus)) {
            state = reservation.getDepositAmount() == 0 ? State.NO_DEPOSIT : State.UNVERIFIED;
        } else if (!"HELD".equals(bookingStatus) || holdUntil == null || !holdUntil.isAfter(Instant.now())) {
            state = State.EXPIRED;
        } else {
            var lastVnPay = vnPayTransactions.findFirstByReservationIdOrderByCreatedAtDesc(reservationId);
            var pendingVnPay = lastVnPay.filter(tx -> tx.getStatus() == VnPayTransactionStatus.PENDING);
            if (pendingVnPay.isPresent()) {
                var attempt = pendingVnPay.get();
                return new BookingPaymentStatus(reservationId, bookingStatus, State.PENDING, 0, reservation.getLockedPrice(),
                        attempt.getAmountVnd(), "VNPAY_ESCROW", attempt.getTxnRef(), null, null);
            }
            var lastPayment = payments.findFirstByBookingIdOrderByCreatedAtDescIdDesc(bookingId);
            var pendingQr = lastPayment.filter(payment -> List.of("MOMO_WALLET", VietQrTransferService.PROVIDER)
                    .contains(payment.getProvider()) && "PENDING".equals(payment.getStatus()));
            if (pendingQr.isPresent()) {
                var attempt = pendingQr.get();
                var data = attempt.getRawPayload();
                BankTransfer transfer = null;
                if (VietQrTransferService.PROVIDER.equals(attempt.getProvider()) && data != null) {
                    if (vietQrTransfers.hasPendingReview(reservationId, VietQrTransferService.field(data, "mode"))) {
                        return new BookingPaymentStatus(reservationId, bookingStatus, State.REVIEW_REQUIRED, 0,
                                reservation.getLockedPrice(), attempt.getAmount(), attempt.getProvider(),
                                attempt.getProviderRef(), null, null);
                    }
                    transfer = VietQrTransferService.bankTransfer(data);
                }
                PaymentQr qr = attempt.getCheckoutQrPayload() == null ? null : new PaymentQr(
                        attempt.getCheckoutQrPayload(), holdUntil, Boolean.TRUE.equals(attempt.getCheckoutQrSandbox()), transfer);
                return new BookingPaymentStatus(reservationId, bookingStatus, State.PENDING, 0, reservation.getLockedPrice(),
                        attempt.getAmount(), attempt.getProvider(), attempt.getProviderRef(), null, qr);
            }
            state = lastVnPay.isPresent() || lastPayment.isPresent() ? State.FAILED : State.NOT_STARTED;
        }
        return new BookingPaymentStatus(reservationId, bookingStatus, state, 0, reservation.getLockedPrice(),
                null, null, null, null, null, state == State.NO_DEPOSIT
                ? balances.status(reservation, reservation.getLockedPrice()) : null);
    }

}
