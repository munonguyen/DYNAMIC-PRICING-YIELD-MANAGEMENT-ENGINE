package com.yieldengine.record.security;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public record SessionPrincipal(
        UUID userId,
        String username,
        List<RoleGrant> roles,
        Instant issuedAt,
        Instant expiresAt
) {
    public boolean hasPlatformRole(String... allowedRoles) {
        if (roles == null) {
            return false;
        }
        for (RoleGrant grant : roles) {
            if ("PLATFORM".equals(grant.scope())) {
                for (String allowed : allowedRoles) {
                    if (allowed.equalsIgnoreCase(grant.roleCode())) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    public boolean hasAnyRole(String... allowedRoles) {
        if (roles == null) {
            return false;
        }
        for (RoleGrant grant : roles) {
            for (String allowed : allowedRoles) {
                if (allowed.equalsIgnoreCase(grant.roleCode())) {
                    return true;
                }
            }
        }
        return false;
    }

    public boolean hasTenantRole(UUID targetTenantId, String... allowedRoles) {
        if (roles == null || targetTenantId == null) {
            return false;
        }
        for (RoleGrant grant : roles) {
            if ("TENANT".equals(grant.scope()) && targetTenantId.equals(grant.tenantId())) {
                for (String allowed : allowedRoles) {
                    if (allowed.equalsIgnoreCase(grant.roleCode())) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    public Optional<UUID> firstTenantIdForRole(String... allowedRoles) {
        if (roles == null) {
            return Optional.empty();
        }
        for (RoleGrant grant : roles) {
            if ("TENANT".equals(grant.scope()) && grant.tenantId() != null) {
                for (String allowed : allowedRoles) {
                    if (allowed.equalsIgnoreCase(grant.roleCode())) {
                        return Optional.of(grant.tenantId());
                    }
                }
            }
        }
        return Optional.empty();
    }

    public String primaryRoleCode() {
        if (roles == null || roles.isEmpty()) {
            return "USER";
        }
        return roles.get(0).roleCode();
    }
}

