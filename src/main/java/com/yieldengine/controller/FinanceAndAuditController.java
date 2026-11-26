package com.yieldengine.controller;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.finance.CreateCommissionRuleRequest;
import com.yieldengine.record.finance.ReconciliationReportResponse;
import com.yieldengine.entity.AuditLog;
import com.yieldengine.entity.CommissionRule;
import com.yieldengine.entity.LedgerEntry;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.service.AuditLogService;
import com.yieldengine.service.FinanceLedgerService;
import com.yieldengine.utils.CommonTextAndPageUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@Tag(name = "5. Finance, Double-Entry Ledger & Audit Trail", description = "Commission rules, Append-only Ledger, Reconciliation & Security Audit Logs")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class FinanceAndAuditController {

    private static final int MAX_PAGE_SIZE = 200;

    private final FinanceLedgerService financeLedgerService;
    private final AuditLogService auditLogService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "Create non-overlapping commission rule (ACCOUNTANT / ADMIN - UC-19)")
    @PostMapping("/finance/commission-rules")
    public ResponseEntity<CommissionRule> createCommissionRule(@Valid @RequestBody CreateCommissionRuleRequest request) {
        SessionPrincipal actor = rbacGuard.requirePlatformRole(SystemConstant.ROLE_ACCOUNTANT, SystemConstant.ROLE_ADMIN);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(financeLedgerService.createCommissionRule(request, actor.userId()));
    }

    @Operation(summary = "Query append-only financial ledger entries (ACCOUNTANT / ADMIN - UC-20)")
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

    @Operation(summary = "Run financial reconciliation report verifying double-entry balance (ACCOUNTANT / ADMIN - UC-20)")
    @GetMapping("/finance/reconciliation")
    public ResponseEntity<ReconciliationReportResponse> reconcile(
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
    ) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ACCOUNTANT, SystemConstant.ROLE_ADMIN);
        return ResponseEntity.ok(financeLedgerService.reconcile(tenantId, from, to));
    }

    @Operation(summary = "Inspect immutable audit logs (ADMIN all; MANAGER own venue; ACCOUNTANT finance - UC-22)")
    @GetMapping("/audit-logs")
    public ResponseEntity<Page<AuditLog>> searchAuditLogs(
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) UUID actorUserId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        SessionPrincipal actor = rbacGuard.requireAuthenticated();
        UUID effectiveTenantId = tenantId;
        if (!actor.hasPlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT)) {
            effectiveTenantId = rbacGuard.resolveAuthorizedTenantId(tenantId, SystemConstant.ROLE_MANAGER);
        }
        return ResponseEntity.ok(auditLogService.searchLogs(
                effectiveTenantId,
                actorUserId,
                action,
                from,
                to,
                CommonTextAndPageUtils.boundedPageable(page, size, MAX_PAGE_SIZE)
        ));
    }
}
