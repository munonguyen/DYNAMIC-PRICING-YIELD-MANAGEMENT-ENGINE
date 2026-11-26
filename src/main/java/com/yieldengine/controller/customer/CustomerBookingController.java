package com.yieldengine.controller.customer;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.dto.response.HoldSlotResponse;
import com.yieldengine.record.ops.*;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.BookingOrchestratorService;
import com.yieldengine.service.CheckInService;
import com.yieldengine.service.QrTicketEmailService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "[ROLE: USER] Customer Bookings & Tickets", description = "Hold slot with PriceLockToken, confirm, cancel & inspect personal QR e-tickets")
@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
public class CustomerBookingController {

    private final BookingOrchestratorService bookingOrchestratorService;
    private final CheckInService checkInService;
    private final QrTicketEmailService qrTicketEmailService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[USER] Hold court with PriceLockToken & Idempotency-Key (UC-12)")
    @PostMapping("/hold")
    public ResponseEntity<HoldSlotResponse> holdSlot(
            @RequestHeader(value = SystemConstant.HEADER_IDEMPOTENCY_KEY, required = false) String idempotencyKey,
            @Valid @RequestBody HoldSlotRequest request
    ) {
        rbacGuard.requireAuthenticated();
        HoldSlotResponse response = bookingOrchestratorService.holdSlot(request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "[USER] Direct confirm reservation deposit")
    @PostMapping("/{reservationId}/confirm")
    public ResponseEntity<Void> confirmReservation(@PathVariable UUID reservationId) {
        rbacGuard.requireAuthenticated();
        bookingOrchestratorService.confirmReservation(reservationId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "[USER / MANAGER] Cancel booking and compute refund/forfeit per frozen policy snapshot (UC-14)")
    @PostMapping("/{reservationId}/cancel")
    public ResponseEntity<CancelBookingResponse> cancelReservation(
            @PathVariable UUID reservationId,
            @RequestBody(required = false) CancelBookingRequest request
    ) {
        rbacGuard.requireAuthenticated();
        CancelBookingResponse response = bookingOrchestratorService.cancelReservationWithPolicy(
                reservationId,
                request != null ? request.slotStart() : null,
                request != null ? request.reason() : null
        );
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "[USER] Issue or retrieve signed single-use QR code for confirmed booking (UC-15)")
    @GetMapping("/{reservationId}/qr")
    public ResponseEntity<QrCodeResponse> getBookingQr(@PathVariable UUID reservationId) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(checkInService.issueOrGetQrCode(reservationId));
    }

    @Operation(summary = "[USER] Send or resend signed PNG QR E-Ticket to email")
    @PostMapping("/{reservationId}/resend-qr-email")
    public ResponseEntity<EmailDispatchResult> resendQrEmail(
            @PathVariable UUID reservationId,
            @Valid @RequestBody ResendQrEmailRequest request
    ) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(qrTicketEmailService.sendQrTicketEmailForReservation(
                reservationId, request.recipientEmail(), null
        ));
    }

    @Operation(summary = "[USER] List persistent e-tickets stored in user's account ('Vé của tôi')")
    @GetMapping("/my-tickets")
    public ResponseEntity<List<MyTicketResponse>> listMyTickets() {
        SessionPrincipal user = rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(bookingOrchestratorService.listMyTickets(user.userId()));
    }
}

