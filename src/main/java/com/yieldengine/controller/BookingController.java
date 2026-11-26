package com.yieldengine.controller;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.momo.MoMoPaymentInitResult;
import com.yieldengine.record.ops.*;
import com.yieldengine.record.ops.EmailDispatchResult;
import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.dto.response.HoldSlotResponse;
import com.yieldengine.mapper.MoMoGatewayMapper;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.service.BookingOrchestratorService;
import com.yieldengine.service.CheckInService;
import com.yieldengine.service.CheckoutPaymentService;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.MoMoSessionRejectedException;
import com.yieldengine.service.MoMoPaymentGatewayService;
import com.yieldengine.service.QrTicketEmailService;
import com.yieldengine.validate.MoMoPaymentValidator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "3. Booking, Deposit Webhook, Cancellation & QR", description = "ACID Hold with Idempotency-Key, Deposit Webhook, Tiered Cancellation & QR Code Issuance")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class BookingController {

    private final BookingOrchestratorService bookingOrchestratorService;
    private final CheckInService checkInService;
    private final CheckoutPaymentService checkoutPaymentService;
    private final MoMoPaymentGatewayService moMoPaymentGatewayService;
    private final MoMoGatewayMapper moMoGatewayMapper;
    private final MoMoPaymentValidator moMoPaymentValidator;
    private final QrTicketEmailService qrTicketEmailService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "Hold court with PriceLockToken, Idempotency-Key, Deposit & Policy Snapshot (UC-12)")
    @PostMapping("/bookings/hold")
    public ResponseEntity<HoldSlotResponse> holdSlot(
            @RequestHeader(value = SystemConstant.HEADER_IDEMPOTENCY_KEY, required = false) String idempotencyKey,
            @Valid @RequestBody HoldSlotRequest request) {
        rbacGuard.requireAuthenticated();
        HoldSlotResponse response = bookingOrchestratorService.holdSlot(request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/payments/providers")
    public java.util.List<String> paymentProviders() {
        return checkoutPaymentService.configuredProviders();
    }

    @GetMapping("/bookings/{reservationId}/payment-status")
    public ResponseEntity<BookingPaymentStatus> paymentStatus(@PathVariable UUID reservationId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(checkoutPaymentService.getStatus(reservationId, rbacGuard.requireAuthenticated().userId()));
    }

    @Operation(summary = "Create MoMo v2 HMAC-SHA256 payment session matching PayGate spec")
    @PostMapping("/payments/momo/create")
    public ResponseEntity<MoMoPaymentSessionResponse> createMoMoPaymentSession(
            @Valid @RequestBody CreateMoMoPaymentRequest request
    ) {
        SessionPrincipal user = rbacGuard.requireAuthenticated();
        moMoPaymentGatewayService.validateInitiation(request.reservationId(), request.amount());
        String orderId = "AP_" + UUID.randomUUID().toString().replace("-", "");
        bookingOrchestratorService.beginMoMoPayment(request, user.userId(), orderId);
        String extraData = java.util.Base64.getEncoder().encodeToString(
                request.reservationId().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        try {
            MoMoPaymentInitResult init = moMoPaymentGatewayService.createPaymentSession(
                    request.reservationId(), request.amount(), orderId,
                    "Dat san ArenaPulse " + request.reservationId().toString().substring(0, 8), extraData);
            bookingOrchestratorService.saveMoMoPaymentQr(request.reservationId(), orderId,
                    init.qrCodeUrl(), moMoPaymentGatewayService.isSandbox());
            return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
                    .body(moMoGatewayMapper.toSessionResponse(init));
        } catch (MoMoSessionRejectedException ex) {
            bookingOrchestratorService.markMoMoCreateRejected(request.reservationId(), orderId);
            throw ex;
        }
    }

    @Operation(summary = "MoMo PayGate v2 IPN Callback with strict HMAC-SHA256 signature verification")
    @PostMapping("/payments/momo/ipn")
    public ResponseEntity<Void> handleMoMoIpnCallback(@Valid @RequestBody MoMoIpnCallbackRequest req) {
        if (!moMoPaymentGatewayService.verifyIpnSignature(req)
                || !req.orderId().equals(req.requestId()) || (req.resultCode() == 0 && req.transId() <= 0)) {
            throw new IllegalArgumentException("Thông báo thanh toán MoMo không hợp lệ.");
        }
        UUID reservationId = moMoPaymentValidator.resolveReservationIdFromIpn(req.reservationId(), req.extraData());
        if (req.resultCode() != 1000 && req.resultCode() != 7000 && req.resultCode() != 7002 && req.resultCode() != 9000) {
            bookingOrchestratorService.processPaymentWebhook(new PaymentWebhookRequest(
                    "MOMO_WALLET", req.orderId(), reservationId, null, req.amount(),
                    req.resultCode() == 0 ? "SUCCESS" : "FAILED"));
        }
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Cancel booking and compute refund/forfeit per frozen policy snapshot & DB clock (UC-14)")
    @PostMapping("/bookings/{reservationId}/cancel")
    public ResponseEntity<CancelBookingResponse> cancelReservation(
            @PathVariable UUID reservationId,
            @RequestBody(required = false) CancelBookingRequest request) {
        rbacGuard.requireAuthenticated();
        CancelBookingResponse response = bookingOrchestratorService.cancelReservationWithPolicy(
                reservationId,
                request != null ? request.slotStart() : null,
                request != null ? request.reason() : null);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Issue or retrieve signed single-use QR code for confirmed booking (UC-15)")
    @GetMapping("/bookings/{reservationId}/qr")
    public ResponseEntity<QrCodeResponse> getBookingQr(@PathVariable UUID reservationId) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(checkInService.issueOrGetQrCode(reservationId));
    }

    @Operation(summary = "Send or resend signed PNG QR E-Ticket directly to recipient Gmail/Email")
    @PostMapping("/bookings/{reservationId}/resend-qr-email")
    public ResponseEntity<EmailDispatchResult> resendQrEmail(
            @PathVariable UUID reservationId,
            @Valid @RequestBody ResendQrEmailRequest request
    ) {
        var status = checkoutPaymentService.getStatus(reservationId, rbacGuard.requireAuthenticated().userId());
        if (status.paymentStatus() != BookingPaymentStatus.State.VERIFIED
                && status.paymentStatus() != BookingPaymentStatus.State.NO_DEPOSIT) {
            throw new BusinessConflictException("Đơn chưa đủ điều kiện gửi vé.");
        }
        return ResponseEntity.ok(qrTicketEmailService.sendQrTicketEmailForReservation(
                reservationId, request.recipientEmail(), null
        ));
    }

    @Operation(summary = "List persistent e-tickets stored in user's account ('Vé của tôi')")
    @GetMapping("/bookings/my-tickets")
    public ResponseEntity<java.util.List<MyTicketResponse>> listMyTickets() {
        SessionPrincipal user = rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(bookingOrchestratorService.listMyTickets(user.userId()));
    }
}
