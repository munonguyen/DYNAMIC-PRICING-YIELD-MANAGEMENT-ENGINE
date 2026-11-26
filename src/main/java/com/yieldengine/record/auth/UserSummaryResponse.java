package com.yieldengine.record.auth;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
public record UserSummaryResponse(
        UUID id,
        String username,
        String email,
        String firstName,
        String lastName,
        String status,
        Instant lastLoginAt,
        Instant deactivatedAt,
        List<RoleAssignmentDto> roles
) {
}
