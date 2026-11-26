package com.yieldengine.controller.publicapi;

import com.yieldengine.record.ops.MoMoIpnCallbackRequest;
import com.yieldengine.record.ops.PaymentWebhookRequest;
import com.yieldengine.record.ops.VietQrBankNotice;
import com.yieldengine.record.vnpay.VnPayIpnResponse;
import com.yieldengine.record.vnpay.VnPayReturnVerificationResponse;
import com.yieldengine.service.BookingOrchestratorService;
import com.yieldengine.service.MoMoPaymentGatewayService;
import com.yieldengine.service.VietQrCallbackAuth;
import com.yieldengine.service.VietQrTransferService;
import com.yieldengine.service.VnPayPaymentService;
import com.yieldengine.validate.MoMoPaymentValidator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Tag(name = "[WEBHOOK] Payment Gateway Callbacks (MoMo, VNPAY & VietQR)", description = "Server-to-server IPN callbacks, VietQR bank transfer sync, and VNPAY browser return verification")
@RestController
@Slf4j
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final BookingOrchestratorService bookingOrchestratorService;
    private final MoMoPaymentGatewayService moMoPaymentGatewayService;
    private final MoMoPaymentValidator moMoPaymentValidator;
    private final VietQrCallbackAuth vietQrCallbackAuth;
    private final VietQrTransferService vietQrTransferService;
    private final VnPayPaymentService vnPayPaymentService;

    @Operation(summary = "[WEBHOOK] MoMo PayGate v2 IPN Callback with strict HMAC-SHA256 & transaction checks")
    @PostMapping("/momo/ipn")
    public ResponseEntity<Void> handleMoMoIpnCallback(
            @Valid @RequestBody MoMoIpnCallbackRequest req
    ) {
        if (!moMoPaymentGatewayService.verifyIpnSignature(req)
                || !req.orderId().equals(req.requestId())
                || (req.resultCode() == 0 && req.transId() <= 0)) {
            throw new IllegalArgumentException("Thông báo thanh toán MoMo không hợp lệ.");
        }
        UUID reservationId = moMoPaymentValidator.resolveReservationIdFromIpn(
                req.reservationId(), req.extraData()
        );
        if (req.resultCode() != 1000 && req.resultCode() != 7000 && req.resultCode() != 7002 && req.resultCode() != 9000) {
            bookingOrchestratorService.processPaymentWebhook(new PaymentWebhookRequest(
                    "MOMO_WALLET",
                    req.orderId(),
                    reservationId,
                    null,
                    req.amount(),
                    req.resultCode() == 0 ? "SUCCESS" : "FAILED"
            ));
        }
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "[WEBHOOK] Issue VietQR bank callback bearer token")
    @PostMapping("/vietqr/api/token_generate")
    public ResponseEntity<Map<String, Object>> vietQrToken(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(vietQrCallbackAuth.issue(authorization));
    }

    @Operation(summary = "[WEBHOOK] VietQR bank transaction-sync callback")
    @PostMapping("/vietqr/bank/api/transaction-sync")
    public Map<String, Object> vietQrTransactionSync(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Valid @RequestBody VietQrBankNotice notice
    ) {
        vietQrCallbackAuth.requireValid(authorization);
        return Map.of("error", false, "object", Map.of("reftransactionid", vietQrTransferService.receive(notice).toString()));
    }

    @Operation(summary = "[CALLBACK] VNPAY browser return URL verification")
    @GetMapping("/vnpay/return")
    public ResponseEntity<VnPayReturnVerificationResponse> handleVnPayReturn(
            @RequestParam Map<String, String> vnpParams
    ) {
        return ResponseEntity.ok(vnPayPaymentService.handleReturnCallback(vnpParams));
    }

    @Operation(summary = "[WEBHOOK] VNPAY server-to-server IPN callback")
    @RequestMapping(value = "/vnpay/ipn", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<VnPayIpnResponse> handleVnPayIpn(
            @RequestParam Map<String, String> vnpParams
    ) {
        try {
            return ResponseEntity.ok(vnPayPaymentService.handleIpnCallback(vnpParams));
        } catch (RuntimeException ex) {
            log.warn("VNPAY IPN could not be processed", ex);
            return ResponseEntity.ok(new VnPayIpnResponse("99", "Unknown error"));
        }
    }
}
