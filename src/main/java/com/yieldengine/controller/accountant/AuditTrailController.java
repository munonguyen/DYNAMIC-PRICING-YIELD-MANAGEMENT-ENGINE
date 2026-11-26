package com.yieldengine.controller.accountant;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.entity.AuditLog;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.AuditLogService;
import com.yieldengine.utils.CommonTextAndPageUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@Tag(name = "[ROLE: ACCOUNTANT / ADMIN / MANAGER] Audit Logs", description = "Immutable security and financial audit trail scoped by role")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AuditTrailController {

    private static final int MAX_PAGE_SIZE = 200;

    private final AuditLogService auditLogService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[ADMIN all / ACCOUNTANT finance / MANAGER own venue] Inspect immutable audit logs (UC-22)")
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

