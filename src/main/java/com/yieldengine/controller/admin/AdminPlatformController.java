package com.yieldengine.controller.admin;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.admin.*;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.AdminGovernanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "[ROLE: ADMIN] Platform Tenants, Users, RBAC & Telemetry", description = "DB-backed multi-tenant oversight, RBAC matrix, commission schedules & audit streams")
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminPlatformController {

    private final AdminGovernanceService adminGovernanceService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[ADMIN / ACCOUNTANT] List registered partner venue tenants with live DB metrics")
    @GetMapping("/tenants")
    public ResponseEntity<List<AdminTenantOverviewDto>> listTenants() {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(adminGovernanceService.listTenantOverviews());
    }

    @Operation(summary = "[ADMIN] Activate or suspend a partner venue tenant in DB")
    @PatchMapping("/tenants/{id}/status")
    public ResponseEntity<AdminTenantOverviewDto> updateTenantStatus(
            @PathVariable UUID id,
            @Valid @RequestBody AdminTenantStatusRequest request
    ) {
        SessionPrincipal admin = rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.ok(adminGovernanceService.updateTenantStatus(id, request.status(), admin));
    }

    @Operation(summary = "[ADMIN / ACCOUNTANT] Inspect all court resource groups stored in PostgreSQL DB")
    @GetMapping("/resource-groups")
    public ResponseEntity<List<AdminVenueGroupDto>> listResourceGroups(
            @RequestParam(required = false) UUID tenantId
    ) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(adminGovernanceService.listVenueGroups(tenantId));
    }

    @Operation(summary = "[ADMIN / ACCOUNTANT] List platform and venue user accounts with active DB role assignments")
    @GetMapping("/users")
    public ResponseEntity<List<AdminUserAccountDto>> listUsers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status
    ) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(adminGovernanceService.listUsers(q, status));
    }

    @Operation(summary = "[ADMIN / ACCOUNTANT] Load live RBAC matrix from roles, permissions & role_permissions tables")
    @GetMapping("/rbac-matrix")
    public ResponseEntity<AdminRbacMatrixResponse> getRbacMatrix() {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(adminGovernanceService.getRbacMatrix());
    }

    @Operation(summary = "[ADMIN / ACCOUNTANT] List active and historical commission rules from DB")
    @GetMapping("/commission-rules")
    public ResponseEntity<List<AdminCommissionRuleDto>> listCommissionRules() {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(adminGovernanceService.listCommissionRules());
    }

    @Operation(summary = "[ADMIN / ACCOUNTANT] List latest append-only ledger entries enriched with tenant names")
    @GetMapping("/ledger-entries")
    public ResponseEntity<List<AdminLedgerEntryDto>> listLedgerEntries(
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(defaultValue = "80") int limit
    ) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(adminGovernanceService.listLedgerEntries(tenantId, limit));
    }

    @Operation(summary = "[ADMIN / ACCOUNTANT] List immutable audit logs enriched from DB")
    @GetMapping("/audit-logs")
    public ResponseEntity<List<AdminAuditLogDto>> listAuditLogs(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(defaultValue = "80") int limit
    ) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(adminGovernanceService.listAuditLogs(action, tenantId, limit));
    }
}

