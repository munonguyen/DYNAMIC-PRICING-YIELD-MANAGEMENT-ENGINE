package com.yieldengine.controller;

import com.yieldengine.record.vnpay.*;
import com.yieldengine.enums.RoleCode;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.VnPayPaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Tag(name = "3b. VNPAY Payment Gateway v2.1.0", description = "Create Payment URL, Return Verification, Idempotent IPN Webhook, QueryDR & Refund")
@RestController
@RequestMapping("/api/v1/payments/vnpay")
@RequiredArgsConstructor
public class VnPayPaymentController {

    private final VnPayPaymentService vnPayPaymentService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "Create HMAC-SHA512 signed VNPAY PayGate v2.1.0 redirect URL")
    @PostMapping("/create-payment")
    public ResponseEntity<VnPayPaymentUrlResponse> createPayment(
            @Valid @RequestBody CreateVnPayPaymentRequest request,
            HttpServletRequest httpRequest
    ) {
        rbacGuard.requireAuthenticated();
        String clientIp = resolveClientIp(httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(vnPayPaymentService.createPaymentUrl(request, clientIp));
    }

    @Operation(summary = "Verify VNPAY browser return callback params and sync reservation status")
    @GetMapping("/return")
    public ResponseEntity<VnPayReturnVerificationResponse> handleReturn(
            @RequestParam Map<String, String> vnpParams
    ) {
        return ResponseEntity.ok(vnPayPaymentService.handleReturnCallback(vnpParams));
    }

    @Operation(summary = "Server-to-Server VNPAY IPN webhook returning strict RspCode/Message acknowledgment")
    @RequestMapping(value = "/ipn", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<VnPayIpnResponse> handleIpn(
            @RequestParam Map<String, String> vnpParams
    ) {
        return ResponseEntity.ok(vnPayPaymentService.handleIpnCallback(vnpParams));
    }

    @Operation(summary = "Query transaction status directly from VNPAY merchant_webapi (QueryDR)")
    @PostMapping("/querydr")
    public ResponseEntity<VnPayQueryDrResponse> queryTransaction(
            @Valid @RequestBody VnPayQueryDrRequest request,
            HttpServletRequest httpRequest
    ) {
        rbacGuard.requirePlatformRole(
                RoleCode.ADMIN.name(),
                RoleCode.MANAGER.name(),
                RoleCode.STAFF.name(),
                RoleCode.ACCOUNTANT.name()
        );
        return ResponseEntity.ok(vnPayPaymentService.queryTransactionStatus(request, resolveClientIp(httpRequest)));
    }

    @Operation(summary = "Execute VNPAY full/partial refund via merchant_webapi")
    @PostMapping("/refund")
    public ResponseEntity<VnPayRefundResponse> refundTransaction(
            @Valid @RequestBody VnPayRefundRequest request,
            HttpServletRequest httpRequest
    ) {
        rbacGuard.requirePlatformRole(
                RoleCode.ADMIN.name(),
                RoleCode.MANAGER.name(),
                RoleCode.ACCOUNTANT.name()
        );
        return ResponseEntity.ok(vnPayPaymentService.refundTransaction(request, resolveClientIp(httpRequest)));
    }

    @Operation(summary = "Get persisted VNPAY transaction summary by vnp_TxnRef")
    @GetMapping("/transactions/{txnRef}")
    public ResponseEntity<VnPayTransactionSummaryDto> getTransaction(@PathVariable String txnRef) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(vnPayPaymentService.getTransactionByTxnRef(txnRef));
    }

    @Operation(summary = "List VNPAY payment attempts for a booking reservation")
    @GetMapping("/reservations/{reservationId}")
    public ResponseEntity<List<VnPayTransactionSummaryDto>> listByReservation(@PathVariable UUID reservationId) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(vnPayPaymentService.listTransactionsByReservation(reservationId));
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String firstIp = forwardedFor.split(",")[0].trim();
            if (!firstIp.isBlank()) {
                return firstIp;
            }
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr != null && !remoteAddr.isBlank()) ? remoteAddr : "127.0.0.1";
    }
}
