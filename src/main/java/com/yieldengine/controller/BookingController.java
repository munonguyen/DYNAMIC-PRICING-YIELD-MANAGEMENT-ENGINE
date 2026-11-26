package com.yieldengine.controller;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.dto.momo.MoMoGatewayDtos.MoMoPaymentInitResult;
import com.yieldengine.dto.ops.BookingOpsDtos.*;
import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.dto.response.HoldSlotResponse;
import com.yieldengine.entity.Reservation;
import com.yieldengine.mapper.MoMoGatewayMapper;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.security.SessionPrincipal;
import com.yieldengine.service.BookingOrchestratorService;
import com.yieldengine.service.CheckInService;
import com.yieldengine.service.MoMoPaymentGatewayService;
import com.yieldengine.service.QrTicketEmailService;
import com.yieldengine.validate.MoMoPaymentValidator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Tag(name = "3. Booking, Deposit Webhook, Cancellation & QR", description = "ACID Hold with Idempotency-Key, Deposit Webhook, Tiered Cancellation & QR Code Issuance")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class BookingController {

    private final BookingOrchestratorService bookingOrchestratorService;
    private final CheckInService checkInService;
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

    @Operation(summary = "Direct confirm reservation deposit")
    @PostMapping("/bookings/{reservationId}/confirm")
    public ResponseEntity<Void> confirmReservation(@PathVariable UUID reservationId) {
        rbacGuard.requireAuthenticated();
        bookingOrchestratorService.confirmReservation(reservationId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Idempotent Payment Provider Webhook confirming deposit or handling late payment (UC-13)")
    @PostMapping("/payments/webhook")
    public ResponseEntity<Map<String, Object>> handlePaymentWebhook(@Valid @RequestBody PaymentWebhookRequest request) {
        Reservation updated = bookingOrchestratorService.processPaymentWebhook(request);
        return ResponseEntity.ok(Map.of(
                "reservationId", updated.getReservationId(),
                "status", updated.getStatus()));
    }

    @Operation(summary = "Create MoMo v2 HMAC-SHA256 payment session matching PayGate spec")
    @PostMapping("/payments/momo/create")
    public ResponseEntity<MoMoPaymentSessionResponse> createMoMoPaymentSession(
            @Valid @RequestBody CreateMoMoPaymentRequest request
    ) {
        rbacGuard.requireAuthenticated();
        bookingOrchestratorService.updateBookingContactDetails(
                request.reservationId(),
                request.customerName(),
                request.customerPhone(),
                request.customerEmail(),
                request.needVatInvoice(),
                request.vatCompanyName(),
                request.vatTaxCode(),
                request.bookingNote()
        );
        String extraData = java.util.Base64.getEncoder().encodeToString(
                request.reservationId().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
        MoMoPaymentInitResult init = moMoPaymentGatewayService.createPaymentSession(
                request.reservationId(),
                request.amount(),
                "Dat san ArenaPulse " + request.reservationId().toString().substring(0, 8),
                extraData
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(moMoGatewayMapper.toSessionResponse(init));
    }

    @Operation(summary = "MoMo PayGate v2 IPN Callback with strict HMAC-SHA256 signature verification")
    @PostMapping("/payments/momo/ipn")
    public ResponseEntity<Map<String, Object>> handleMoMoIpnCallback(
            @Valid @RequestBody MoMoIpnCallbackRequest req
    ) {
        if (!moMoPaymentGatewayService.verifyIpnSignature(req)) {
            throw new IllegalArgumentException("Chữ ký HMAC-SHA256 MoMo IPN không hợp lệ.");
        }
        UUID resolvedReservationId = moMoPaymentValidator.resolveReservationIdFromIpn(
                req.reservationId(), req.extraData()
        );
        String status = req.resultCode() == 0 ? "SUCCESS" : "FAILED";
        Reservation updated = bookingOrchestratorService.processPaymentWebhook(
                moMoGatewayMapper.toPaymentWebhook(req, resolvedReservationId, status)
        );
        return ResponseEntity.ok(Map.of(
                "resultCode", 0,
                "reservationId", updated.getReservationId(),
                "status", updated.getStatus()
        ));
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
    public ResponseEntity<QrTicketEmailService.EmailDispatchResult> resendQrEmail(
            @PathVariable UUID reservationId,
            @Valid @RequestBody ResendQrEmailRequest request
    ) {
        rbacGuard.requireAuthenticated();
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
