package com.yieldengine.record.auth;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
public record AuthResponse(
        String accessToken,
        Instant expiresAt,
        UUID userId,
        String username,
        String email,
        String fullName,
        List<RoleAssignmentDto> roles
) {
}
