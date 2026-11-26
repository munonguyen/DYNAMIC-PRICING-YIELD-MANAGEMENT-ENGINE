package com.yieldengine.controller.accountant;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.entity.CommissionRule;
import com.yieldengine.entity.LedgerEntry;
import com.yieldengine.enums.RoleCode;
import com.yieldengine.record.finance.CreateCommissionRuleRequest;
import com.yieldengine.record.finance.ReconciliationReportResponse;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.record.vnpay.VnPayQueryDrRequest;
import com.yieldengine.record.vnpay.VnPayQueryDrResponse;
import com.yieldengine.record.vnpay.VnPayRefundRequest;
import com.yieldengine.record.vnpay.VnPayRefundResponse;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.FinanceLedgerService;
import com.yieldengine.service.VnPayPaymentService;
import com.yieldengine.utils.CommonTextAndPageUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@Tag(name = "[ROLE: ACCOUNTANT / ADMIN] Double-Entry Ledger, Commission & Refunds", description = "Commission rules, append-only ledger reconciliation & VNPAY QueryDR/Refund tools")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AccountantFinanceController {

    private static final int MAX_PAGE_SIZE = 200;

    private final FinanceLedgerService financeLedgerService;
    private final VnPayPaymentService vnPayPaymentService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[ACCOUNTANT / ADMIN] Create non-overlapping commission rule (UC-19)")
    @PostMapping("/finance/commission-rules")
    public ResponseEntity<CommissionRule> createCommissionRule(
            @Valid @RequestBody CreateCommissionRuleRequest request
    ) {
        SessionPrincipal actor = rbacGuard.requirePlatformRole(
                SystemConstant.ROLE_ACCOUNTANT, SystemConstant.ROLE_ADMIN
        );
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(financeLedgerService.createCommissionRule(request, actor.userId()));
    }

    @Operation(summary = "[ACCOUNTANT / ADMIN] Query append-only financial ledger entries (UC-20)")
    @GetMapping("/finance/ledger")
    public ResponseEntity<Page<LedgerEntry>> getLedgerEntries(
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ACCOUNTANT, SystemConstant.ROLE_ADMIN);
        return ResponseEntity.ok(financeLedgerService.getLedgerEntries(
                tenantId, from, to, CommonTextAndPageUtils.boundedPageable(page, size, MAX_PAGE_SIZE)
        ));
    }

    @Operation(summary = "[ACCOUNTANT / ADMIN] Run financial reconciliation verifying double-entry balance (UC-20)")
    @GetMapping("/finance/reconciliation")
    public ResponseEntity<ReconciliationReportResponse> reconcile(
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
    ) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ACCOUNTANT, SystemConstant.ROLE_ADMIN);
        return ResponseEntity.ok(financeLedgerService.reconcile(tenantId, from, to));
    }

    @Operation(summary = "[ACCOUNTANT / MANAGER / STAFF / ADMIN] Query VNPAY transaction status via merchant_webapi")
    @PostMapping("/payments/vnpay/querydr")
    public ResponseEntity<VnPayQueryDrResponse> queryVnPayTransaction(
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

    @Operation(summary = "[ACCOUNTANT / MANAGER / ADMIN] Execute VNPAY full/partial refund via merchant_webapi")
    @PostMapping("/payments/vnpay/refund")
    public ResponseEntity<VnPayRefundResponse> refundVnPayTransaction(
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

