package com.yieldengine.record.auth;

import java.util.UUID;
public record RoleAssignmentDto(
        String roleCode,
        String scope,
        UUID tenantId
) {
}
