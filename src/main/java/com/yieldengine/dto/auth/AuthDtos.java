package com.yieldengine.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 50) String username,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank @Size(max = 80) String firstName,
            @NotBlank @Size(max = 80) String lastName,
            String phone
    ) {
    }

    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password
    ) {
    }

    public record RoleAssignmentDto(
            String roleCode,
            String scope,
            UUID tenantId
    ) {
    }

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

    public record UserStatusUpdateRequest(
            @NotBlank String status
    ) {
    }

    public record AssignRoleRequest(
            @NotBlank String roleCode,
            UUID tenantId
    ) {
    }

    public record CreateStaffRequest(
            @NotBlank @Size(min = 3, max = 50) String username,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank String firstName,
            @NotBlank String lastName
    ) {
    }

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
}

