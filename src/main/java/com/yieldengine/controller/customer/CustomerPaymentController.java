package com.yieldengine.controller.customer;

import com.yieldengine.mapper.MoMoGatewayMapper;
import com.yieldengine.record.momo.MoMoPaymentInitResult;
import com.yieldengine.record.ops.CreateMoMoPaymentRequest;
import com.yieldengine.record.ops.MoMoPaymentSessionResponse;
import com.yieldengine.record.vnpay.CreateVnPayPaymentRequest;
import com.yieldengine.record.vnpay.VnPayPaymentUrlResponse;
import com.yieldengine.record.vnpay.VnPayTransactionSummaryDto;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.BookingOrchestratorService;
import com.yieldengine.service.MoMoPaymentGatewayService;
import com.yieldengine.service.VnPayPaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Tag(name = "[ROLE: USER] Customer Payment Sessions", description = "Create MoMo / VNPAY checkout sessions and view personal payment attempts")
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class CustomerPaymentController {

    private final BookingOrchestratorService bookingOrchestratorService;
    private final MoMoPaymentGatewayService moMoPaymentGatewayService;
    private final MoMoGatewayMapper moMoGatewayMapper;
    private final VnPayPaymentService vnPayPaymentService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[USER] Create MoMo v2 HMAC-SHA256 payment session")
    @PostMapping("/momo/create")
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
        String extraData = Base64.getEncoder().encodeToString(
                request.reservationId().toString().getBytes(StandardCharsets.UTF_8)
        );
        MoMoPaymentInitResult init = moMoPaymentGatewayService.createPaymentSession(
                request.reservationId(),
                request.amount(),
                "Dat san ArenaPulse " + request.reservationId().toString().substring(0, 8),
                extraData
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(moMoGatewayMapper.toSessionResponse(init));
    }

    @Operation(summary = "[USER] Create HMAC-SHA512 signed VNPAY PayGate v2.1.0 redirect URL")
    @PostMapping("/vnpay/create-payment")
    public ResponseEntity<VnPayPaymentUrlResponse> createVnPayPayment(
            @Valid @RequestBody CreateVnPayPaymentRequest request,
            HttpServletRequest httpRequest
    ) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(vnPayPaymentService.createPaymentUrl(request, resolveClientIp(httpRequest)));
    }

    @Operation(summary = "[USER] Get persisted VNPAY transaction summary by vnp_TxnRef")
    @GetMapping("/vnpay/transactions/{txnRef}")
    public ResponseEntity<VnPayTransactionSummaryDto> getVnPayTransaction(@PathVariable String txnRef) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(vnPayPaymentService.getTransactionByTxnRef(txnRef));
    }

    @Operation(summary = "[USER] List VNPAY payment attempts for a booking reservation")
    @GetMapping("/vnpay/reservations/{reservationId}")
    public ResponseEntity<List<VnPayTransactionSummaryDto>> listVnPayByReservation(
            @PathVariable UUID reservationId
    ) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(vnPayPaymentService.listTransactionsByReservation(reservationId));
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) return "127.0.0.1";
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String firstIp = forwardedFor.split(",")[0].trim();
            if (!firstIp.isBlank()) return firstIp;
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr != null && !remoteAddr.isBlank()) ? remoteAddr : "127.0.0.1";
    }
}

