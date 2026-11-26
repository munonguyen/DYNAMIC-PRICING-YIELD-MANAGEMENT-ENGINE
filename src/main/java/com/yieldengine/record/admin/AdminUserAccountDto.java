package com.yieldengine.record.admin;

import com.yieldengine.record.auth.RoleAssignmentDto;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminUserAccountDto(
        UUID id,
        String username,
        String email,
        String fullName,
        String phone,
        String status,
        short failedLoginAttempts,
        Instant lockedUntil,
        Instant lastLoginAt,
        Instant createdAt,
        List<RoleAssignmentDto> roles
) {
}

