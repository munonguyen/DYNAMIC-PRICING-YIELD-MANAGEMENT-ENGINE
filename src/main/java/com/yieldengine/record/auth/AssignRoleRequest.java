package com.yieldengine.record.auth;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;
public record AssignRoleRequest(
        @NotBlank String roleCode,
        UUID tenantId
) {
}
