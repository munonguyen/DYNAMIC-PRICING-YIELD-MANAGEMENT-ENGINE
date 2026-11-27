package com.yieldengine.controller.customer;

import com.yieldengine.exception.MoMoSessionRejectedException;
import com.yieldengine.mapper.MoMoGatewayMapper;
import com.yieldengine.record.momo.MoMoPaymentInitResult;
import com.yieldengine.record.ops.BookingPaymentStatus;
import com.yieldengine.record.ops.CreateQrPaymentRequest;
import com.yieldengine.record.ops.MoMoPaymentSessionResponse;
import com.yieldengine.record.ops.MyTicketResponse;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.record.vnpay.CreateVnPayPaymentRequest;
import com.yieldengine.record.vnpay.VnPayPaymentUrlResponse;
import com.yieldengine.record.vnpay.VnPayTransactionSummaryDto;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.BookingOrchestratorService;
import com.yieldengine.service.CustomerTicketReadService;
import com.yieldengine.service.CheckoutPaymentService;
import com.yieldengine.service.MoMoPaymentGatewayService;
import com.yieldengine.service.VietQrTransferService;
import com.yieldengine.service.VnPayPaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Tag(name = "[ROLE: USER] Customer Payment Sessions", description = "Create MoMo, dynamic VietQR & VNPAY checkout sessions and view personal payment attempts")
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class CustomerPaymentController {

    private final BookingOrchestratorService bookingOrchestratorService;
    private final CustomerTicketReadService ticketReadService;
    private final CheckoutPaymentService checkoutPaymentService;
    private final MoMoPaymentGatewayService moMoPaymentGatewayService;
    private final MoMoGatewayMapper moMoGatewayMapper;
    private final VietQrTransferService vietQrTransferService;
    private final VnPayPaymentService vnPayPaymentService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[USER] List configured online payment providers for checkout")
    @GetMapping("/providers")
    public List<String> paymentProviders() {
        return checkoutPaymentService.configuredProviders();
    }

    @Operation(summary = "[USER] List authenticated customer payment & ticket history from PostgreSQL")
    @GetMapping("/history")
    public ResponseEntity<List<MyTicketResponse>> paymentHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        SessionPrincipal user = rbacGuard.requireAuthenticated();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(ticketReadService.listPaymentHistory(user.userId(), page, size));
    }

    @Operation(summary = "[USER] Create MoMo v2 HMAC-SHA256 payment session matching PayGate spec")
    @PostMapping("/momo/create")
    public ResponseEntity<MoMoPaymentSessionResponse> createMoMoPaymentSession(
            @Valid @RequestBody CreateQrPaymentRequest request
    ) {
        SessionPrincipal user = rbacGuard.requireAuthenticated();
        moMoPaymentGatewayService.validateInitiation(request.reservationId(), request.amount());
        String orderId = "AP_" + UUID.randomUUID().toString().replace("-", "");
        bookingOrchestratorService.beginQrPayment(request, user.userId(), "MOMO_WALLET", orderId);
        String extraData = Base64.getEncoder().encodeToString(
                request.reservationId().toString().getBytes(StandardCharsets.UTF_8)
        );
        try {
            MoMoPaymentInitResult init = moMoPaymentGatewayService.createPaymentSession(
                    request.reservationId(),
                    request.amount(),
                    orderId,
                    "Dat san ArenaPulse " + request.reservationId().toString().substring(0, 8),
                    extraData
            );
            bookingOrchestratorService.savePaymentQr(
                    request.reservationId(),
                    "MOMO_WALLET",
                    orderId,
                    init.qrCodeUrl(),
                    moMoPaymentGatewayService.isSandbox(),
                    null
            );
            return ResponseEntity.status(HttpStatus.CREATED)
                    .cacheControl(CacheControl.noStore())
                    .body(moMoGatewayMapper.toSessionResponse(init));
        } catch (MoMoSessionRejectedException ex) {
            bookingOrchestratorService.markQrCreateRejected(request.reservationId(), "MOMO_WALLET", orderId);
            throw ex;
        }
    }

    @Operation(summary = "[USER] Create dynamic VietQR bank transfer session for a reservation")
    @PostMapping("/vietqr/create")
    public ResponseEntity<BookingPaymentStatus> createVietQrPayment(
            @Valid @RequestBody CreateQrPaymentRequest request
    ) {
        UUID owner = rbacGuard.requireAuthenticated().userId();
        vietQrTransferService.create(request, owner);
        return ResponseEntity.status(HttpStatus.CREATED)
                .cacheControl(CacheControl.noStore())
                .body(checkoutPaymentService.getStatus(request.reservationId(), owner));
    }

    @Operation(summary = "[USER] Create or retrieve a VietQR code for the remaining booking balance")
    @PostMapping("/vietqr/balance/{reservationId}")
    public ResponseEntity<BookingPaymentStatus> createVietQrBalance(@PathVariable UUID reservationId) {
        UUID owner = rbacGuard.requireAuthenticated().userId();
        vietQrTransferService.createBalance(reservationId, owner);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(checkoutPaymentService.getStatus(reservationId, owner));
    }

    @Operation(summary = "[USER] Create HMAC-SHA512 signed VNPAY PayGate v2.1.0 redirect URL")
    @PostMapping("/vnpay/create-payment")
    public ResponseEntity<VnPayPaymentUrlResponse> createVnPayPayment(
            @Valid @RequestBody CreateVnPayPaymentRequest request,
            HttpServletRequest httpRequest
    ) {
        var actor = rbacGuard.requireAuthenticated();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(vnPayPaymentService.createPaymentUrl(request, resolveClientIp(httpRequest), actor.userId()));
    }

    @Operation(summary = "[USER] Get persisted VNPAY transaction summary by vnp_TxnRef")
    @GetMapping("/vnpay/transactions/{txnRef}")
    public ResponseEntity<VnPayTransactionSummaryDto> getVnPayTransaction(@PathVariable String txnRef) {
        return ResponseEntity.ok(vnPayPaymentService.getTransactionByTxnRef(txnRef, rbacGuard.requireAuthenticated()));
    }

    @Operation(summary = "[USER] List VNPAY payment attempts for a booking reservation")
    @GetMapping("/vnpay/reservations/{reservationId}")
    public ResponseEntity<List<VnPayTransactionSummaryDto>> listVnPayByReservation(
            @PathVariable UUID reservationId
    ) {
        return ResponseEntity.ok(vnPayPaymentService.listTransactionsByReservation(reservationId, rbacGuard.requireAuthenticated()));
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
