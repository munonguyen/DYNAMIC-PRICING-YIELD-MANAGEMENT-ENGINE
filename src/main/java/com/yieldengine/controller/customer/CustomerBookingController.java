package com.yieldengine.controller.customer;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.dto.response.HoldSlotResponse;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.record.ops.*;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.BookingOrchestratorService;
import com.yieldengine.service.CustomerTicketReadService;
import com.yieldengine.service.CheckInService;
import com.yieldengine.service.CheckoutPaymentService;
import com.yieldengine.service.QrTicketEmailService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "[ROLE: USER] Customer Bookings & Tickets", description = "Hold slot with PriceLockToken, check payment status, cancel & inspect personal QR e-tickets")
@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
public class CustomerBookingController {

    private final BookingOrchestratorService bookingOrchestratorService;
    private final CustomerTicketReadService ticketReadService;
    private final CheckInService checkInService;
    private final CheckoutPaymentService checkoutPaymentService;
    private final QrTicketEmailService qrTicketEmailService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[USER] Hold court with PriceLockToken & Idempotency-Key (UC-12)")
    @PostMapping("/hold")
    public ResponseEntity<HoldSlotResponse> holdSlot(
            @RequestHeader(value = SystemConstant.HEADER_IDEMPOTENCY_KEY, required = false) String idempotencyKey,
            @Valid @RequestBody HoldSlotRequest request
    ) {
        String owner = rbacGuard.requireAuthenticated().userId().toString();
        if (!owner.equals(request.getUserId())) {
            throw new com.yieldengine.exception.ForbiddenAccessException("Lượt giữ sân phải thuộc phiên đăng nhập hiện tại.");
        }
        HoldSlotResponse response = bookingOrchestratorService.holdSlot(request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "[USER] Poll verified checkout payment status for a reservation")
    @GetMapping("/{reservationId}/payment-status")
    public ResponseEntity<BookingPaymentStatus> paymentStatus(@PathVariable UUID reservationId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(checkoutPaymentService.getStatus(reservationId, rbacGuard.requireAuthenticated().userId()));
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
        var status = checkoutPaymentService.getStatus(reservationId, rbacGuard.requireAuthenticated().userId());
        if (status.paymentStatus() != BookingPaymentStatus.State.VERIFIED
                && status.paymentStatus() != BookingPaymentStatus.State.NO_DEPOSIT) {
            throw new BusinessConflictException("Đơn chưa đủ điều kiện gửi vé.");
        }
        return ResponseEntity.ok(qrTicketEmailService.sendQrTicketEmailForReservation(
                reservationId, request.recipientEmail(), null
        ));
    }

    @Operation(summary = "[USER] List persistent e-tickets stored in user's account ('Vé của tôi')")
    @GetMapping("/my-tickets")
    public ResponseEntity<List<MyTicketResponse>> listMyTickets(
            @RequestParam(required = false) UUID reservationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        SessionPrincipal user = rbacGuard.requireAuthenticated();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ticketReadService.listTickets(user.userId(), reservationId, page, size));
    }
}

