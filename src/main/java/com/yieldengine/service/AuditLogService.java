package com.yieldengine.service;

import com.yieldengine.entity.AuditLog;
import com.yieldengine.entity.AuditLogId;
import com.yieldengine.repository.AuditLogRepository;
import com.yieldengine.security.AuthContext;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.utils.TimeAndRangeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public void record(
            UUID explicitActorId,
            String explicitActorRole,
            UUID tenantId,
            String action,
            String entityType,
            String entityId,
            Map<String, Object> details
    ) {
        UUID actorId = explicitActorId;
        String actorRole = explicitActorRole;
        if (actorId == null) {
            SessionPrincipal current = AuthContext.current().orElse(null);
            if (current != null) {
                actorId = current.userId();
                actorRole = current.primaryRoleCode();
            }
        }

        AuditLog entry = AuditLog.builder()
                .id(new AuditLogId(UUID.randomUUID(), Instant.now()))
                .actorUserId(actorId)
                .actorRole(actorRole)
                .tenantId(tenantId)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .details(details != null ? details : Map.of())
                .build();
        auditLogRepository.save(entry);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> searchLogs(
            UUID tenantId,
            UUID actorUserId,
            String action,
            Instant fromTime,
            Instant toTime,
            Pageable pageable
    ) {
        return auditLogRepository.searchAuditLogs(
                tenantId,
                actorUserId,
                action,
                TimeAndRangeUtils.resolveFromTimeOrEpoch(fromTime),
                TimeAndRangeUtils.resolveToTimeOrNowBuffer(toTime),
                pageable
        );
    }
}
