package com.yieldengine.controller;

import com.yieldengine.record.ops.BookingPaymentStatus;
import com.yieldengine.record.ops.CreateQrPaymentRequest;
import com.yieldengine.record.ops.VietQrBankNotice;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.CheckoutPaymentService;
import com.yieldengine.service.VietQrCallbackAuth;
import com.yieldengine.service.VietQrTransferService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/vietqr")
@RequiredArgsConstructor
public class VietQrPaymentController {
    private final VietQrTransferService transfers;
    private final VietQrCallbackAuth auth;
    private final CheckoutPaymentService checkout;
    private final RbacGuard rbac;

    @PostMapping("/create")
    public ResponseEntity<BookingPaymentStatus> create(@Valid @RequestBody CreateQrPaymentRequest request) {
        UUID owner = rbac.requireAuthenticated().userId();
        transfers.create(request, owner);
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
                .body(checkout.getStatus(request.reservationId(), owner));
    }

    @PostMapping("/api/token_generate")
    public ResponseEntity<Map<String, Object>> token(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(auth.issue(authorization));
    }

    @PostMapping("/bank/api/transaction-sync")
    public Map<String, Object> sync(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                                   @Valid @RequestBody VietQrBankNotice notice) {
        auth.requireValid(authorization);
        return Map.of("error", false, "object", Map.of("reftransactionid", transfers.receive(notice).toString()));
    }

    @GetMapping("/review")
    public ResponseEntity<List<VietQrTransferService.ReviewItem>> reviewQueue() {
        rbac.requirePlatformRole("ADMIN", "ACCOUNTANT");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(transfers.reviewQueue());
    }

    @PatchMapping("/review/{id}")
    public ResponseEntity<Void> closeReview(@PathVariable UUID id, @Valid @RequestBody ReviewResolution resolution) {
        var actor = rbac.requirePlatformRole("ADMIN", "ACCOUNTANT");
        transfers.closeReview(id, actor.userId(), resolution.note());
        return ResponseEntity.noContent().build();
    }

    public record ReviewResolution(@NotBlank @Size(max = 500) String note) {}
}
