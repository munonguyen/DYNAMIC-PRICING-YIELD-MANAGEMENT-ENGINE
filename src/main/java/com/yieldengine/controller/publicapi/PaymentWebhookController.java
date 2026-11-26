package com.yieldengine.controller.publicapi;

import com.yieldengine.entity.Reservation;
import com.yieldengine.mapper.MoMoGatewayMapper;
import com.yieldengine.record.ops.MoMoIpnCallbackRequest;
import com.yieldengine.record.ops.PaymentWebhookRequest;
import com.yieldengine.record.vnpay.VnPayIpnResponse;
import com.yieldengine.record.vnpay.VnPayReturnVerificationResponse;
import com.yieldengine.service.BookingOrchestratorService;
import com.yieldengine.service.MoMoPaymentGatewayService;
import com.yieldengine.service.VnPayPaymentService;
import com.yieldengine.validate.MoMoPaymentValidator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Tag(name = "[WEBHOOK] Payment Gateway Callbacks (MoMo & VNPAY)", description = "Server-to-server IPN callbacks and VNPAY browser return verification")
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final BookingOrchestratorService bookingOrchestratorService;
    private final MoMoPaymentGatewayService moMoPaymentGatewayService;
    private final MoMoGatewayMapper moMoGatewayMapper;
    private final MoMoPaymentValidator moMoPaymentValidator;
    private final VnPayPaymentService vnPayPaymentService;

    @Operation(summary = "[WEBHOOK] Generic Payment Provider Webhook (UC-13)")
    @PostMapping("/webhook")
    public ResponseEntity<Map<String, Object>> handlePaymentWebhook(
            @Valid @RequestBody PaymentWebhookRequest request
    ) {
        Reservation updated = bookingOrchestratorService.processPaymentWebhook(request);
        return ResponseEntity.ok(Map.of(
                "reservationId", updated.getReservationId(),
                "status", updated.getStatus()
        ));
    }

    @Operation(summary = "[WEBHOOK] MoMo PayGate v2 IPN Callback with HMAC-SHA256 verification")
    @PostMapping("/momo/ipn")
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
        return ResponseEntity.ok(vnPayPaymentService.handleIpnCallback(vnpParams));
    }
}

