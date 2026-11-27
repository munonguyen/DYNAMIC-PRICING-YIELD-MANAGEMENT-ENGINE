package com.yieldengine.service;

import com.yieldengine.config.VietQrProperties;
import com.yieldengine.entity.Payment;
import com.yieldengine.entity.Reservation;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.record.ops.BookingPaymentStatus.BalancePayment;
import com.yieldengine.record.ops.BookingPaymentStatus.BalanceState;
import com.yieldengine.record.ops.BookingPaymentStatus.PaymentQr;
import com.yieldengine.repository.BookingRepository;
import com.yieldengine.repository.PaymentRepository;
import com.yieldengine.repository.ReservationRepository;
import com.yieldengine.repository.ResourceGroupRepository;
import com.yieldengine.utils.DbClockUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VietQrBalanceService {
    private static final Duration QR_TTL = Duration.ofMinutes(10);
    private static final String TYPE = "BALANCE";

    private final VietQrProperties properties;
    private final ReservationRepository reservations;
    private final BookingRepository bookings;
    private final ResourceGroupRepository groups;
    private final PaymentRepository payments;
    private final FinanceLedgerService ledger;
    private final JdbcTemplate jdbc;

    @Transactional
    public Attempt prepare(UUID reservationId, UUID owner, String order) {
        var reservation = reservations.lockByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt sân."));
        BookingOrchestratorService.requireOwner(reservation, owner);
        Instant now = DbClockUtils.now(jdbc);
        long remaining = amountDue(reservation);
        if (!canPay(reservation, remaining)) {
            throw new BusinessConflictException("Đơn này không còn khoản thanh toán online khả dụng.");
        }
        Instant deadline = deadline(reservation);
        if (!deadline.isAfter(now)) {
            throw new BusinessConflictException("Đã hết thời gian thanh toán phần còn lại của ca sân.");
        }
        var current = pendingFor(reservation);
        if (current.isPresent()) {
            var payment = current.get();
            if (needsReview(reservationId, payment) || payment.getCheckoutQrExpiresAt().isAfter(now)) {
                return new Attempt(payment.getProviderRef(), payment.getAmount(), false);
            }
            payment.setStatus("FAILED");
            payment.setCheckoutQrPayload(null);
            // Release the unique pending attempt before inserting its replacement.
            payments.flush();
        }

        var booking = bookings.findById(reservation.getBookingId()).orElseThrow();
        Instant expiry = now.plus(QR_TTL).isBefore(deadline) ? now.plus(QR_TTL) : deadline;
        payments.save(Payment.builder().booking(booking).tenant(booking.getTenant())
                .provider(VietQrTransferService.PROVIDER).providerRef(order).paymentType(TYPE)
                .amount(remaining).currency(booking.getCurrency()).status("PENDING").checkoutQrExpiresAt(expiry)
                .build());
        return new Attempt(order, remaining, true);
    }

    public BalancePayment status(Reservation reservation, long remaining) {
        if (!"CONFIRMED".equals(reservation.getStatus()) || remaining <= 0) return null;
        var current = pendingFor(reservation);
        if (current.isPresent()) {
            var payment = current.get();
            if (needsReview(reservation.getReservationId(), payment)) {
                return new BalancePayment(BalanceState.REVIEW_REQUIRED, payment.getAmount(), payment.getProviderRef(), null);
            }
            if (payment.getCheckoutQrExpiresAt().isAfter(DbClockUtils.now(jdbc))) {
                return new BalancePayment(BalanceState.PENDING, payment.getAmount(), payment.getProviderRef(), toQr(payment));
            }
        }
        return properties.isConfigured() && canPay(reservation, remaining)
                && deadline(reservation).isAfter(DbClockUtils.now(jdbc))
                ? new BalancePayment(BalanceState.AVAILABLE, remaining, null, null) : null;
    }

    long commissionBasis(Reservation reservation, long collectedEscrow) {
        if (collectedEscrow <= reservation.getDepositAmount() || reservation.getBookingId() == null) {
            return collectedEscrow;
        }
        return Math.max(0, collectedEscrow - payments.sumVerifiedCheckoutBalances(reservation.getBookingId()));
    }

    public void requireNoActiveAttempt(Reservation reservation, Instant now) {
        if (pendingFor(reservation).filter(payment -> payment.getCheckoutQrExpiresAt().isAfter(now)).isPresent()) {
            throw new BusinessConflictException("Khách đang có mã thanh toán phần còn lại. Hãy chờ cổng xác nhận hoặc mã hết hạn.");
        }
    }

    // Called by the authenticated bank callback with the reservation already locked.
    String apply(Reservation reservation, Payment payment, Instant bankTime) {
        if (!"CONFIRMED".equals(reservation.getStatus())) return "BOOKING_NOT_AVAILABLE";
        if (!isBalanceAttempt(payment) || !bankTime.isBefore(payment.getCheckoutQrExpiresAt())) return "BALANCE_EXPIRED";
        if (amountDue(reservation) != payment.getAmount()) return "BALANCE_CHANGED";

        payment.setStatus("SUCCESS");
        payment.setGatewayVerifiedAt(DbClockUtils.now(jdbc));
        payment.setCheckoutQrPayload(null);
        payment.setCheckoutQrSandbox(null);
        payments.save(payment);
        ledger.recordBalanceCollected(reservation, payment);
        return null;
    }

    private boolean canPay(Reservation reservation, long remaining) {
        if (!"CONFIRMED".equals(reservation.getStatus()) || reservation.getBookingId() == null || remaining <= 0) return false;
        return reservation.getDepositAmount() == 0
                || payments.sumSuccessfulEscrowByBookingId(reservation.getBookingId()) >= reservation.getDepositAmount();
    }

    private Instant deadline(Reservation reservation) {
        var group = groups.findById(reservation.getGroupId()).orElseThrow();
        int grace = group.getNoshowGraceMinutes() == null ? 15 : group.getNoshowGraceMinutes();
        return reservation.getSlotStart().plus(Duration.ofMinutes(grace));
    }

    private long amountDue(Reservation reservation) {
        if (reservation.getBookingId() == null) return 0;
        return Math.max(0, reservation.getLockedPrice() - payments.sumSuccessfulPaidByBookingId(reservation.getBookingId()));
    }

    private Optional<Payment> pendingFor(Reservation reservation) {
        if (reservation.getBookingId() == null) return Optional.empty();
        return payments.findPendingVietQrBalance(reservation.getBookingId());
    }

    static boolean isBalanceAttempt(Payment payment) {
        return TYPE.equals(payment.getPaymentType()) && payment.getCheckoutQrExpiresAt() != null;
    }

    private boolean needsReview(UUID reservationId, Payment payment) {
        var data = payment.getRawPayload();
        if (data == null) return false;
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM vietqr_bank_transfers
                    WHERE reservation_id = ? AND mode = ? AND status = 'REVIEW_REQUIRED'
                      AND (order_code = ? OR content = ?)
                )
                """, Boolean.class, reservationId, VietQrTransferService.field(data, "mode"), payment.getProviderRef(), VietQrTransferService.field(data, "content")));
    }

    private PaymentQr toQr(Payment payment) {
        var data = payment.getRawPayload();
        if (payment.getCheckoutQrPayload() == null || data == null) return null;
        return new PaymentQr(payment.getCheckoutQrPayload(), payment.getCheckoutQrExpiresAt(),
                Boolean.TRUE.equals(payment.getCheckoutQrSandbox()), VietQrTransferService.bankTransfer(data));
    }

    public record Attempt(String order, long amount, boolean created) {}
}
