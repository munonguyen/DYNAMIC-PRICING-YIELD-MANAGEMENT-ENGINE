package com.yieldengine.record.admin;

import java.time.Instant;
import java.util.UUID;

public record AdminAuditLogDto(
        UUID auditId,
        UUID actorUserId,
        String actorUsername,
        String actorRole,
        UUID tenantId,
        String tenantName,
        String action,
        String entityType,
        String entityId,
        String detailsJson,
        Instant createdAt
) {
}

