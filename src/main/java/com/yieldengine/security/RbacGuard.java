package com.yieldengine.security;

import com.yieldengine.exception.ForbiddenAccessException;
import com.yieldengine.exception.UnauthorizedException;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.UUID;

/**
 * Policy Enforcement Guard for Multi-Scope RBAC & Tenant Isolation (FR-04, NFR-04).
 */
@Component
public class RbacGuard {

    public SessionPrincipal requireAuthenticated() {
        return AuthContext.current()
                .orElseThrow(() -> new UnauthorizedException("Authentication required"));
    }

    public SessionPrincipal requirePlatformRole(String... allowedRoles) {
        SessionPrincipal principal = requireAuthenticated();
        if (!principal.hasPlatformRole(allowedRoles)) {
            throw new ForbiddenAccessException("Insufficient platform privileges. Required one of: " + Arrays.toString(allowedRoles));
        }
        return principal;
    }

    public SessionPrincipal requireAnyRole(String... allowedRoles) {
        SessionPrincipal principal = requireAuthenticated();
        if (!principal.hasAnyRole(allowedRoles)) {
            throw new ForbiddenAccessException("Truy cập nội bộ bị từ chối. Yêu cầu vai trò: " + Arrays.toString(allowedRoles));
        }
        return principal;
    }

    public SessionPrincipal requireTenantRoleOrAdmin(UUID tenantId, String... allowedTenantRoles) {
        SessionPrincipal principal = requireAuthenticated();
        if (principal.hasPlatformRole("ADMIN")) {
            return principal;
        }
        if (!principal.hasTenantRole(tenantId, allowedTenantRoles)) {
            throw new ForbiddenAccessException("Access denied for venue: " + tenantId);
        }
        return principal;
    }

    /**
     * Resolves tenant ID strictly from authenticated session for tenant-scoped actors (NFR-04).
     * Platform ADMIN may supply explicitTenantId when acting on a specific venue.
     */
    public UUID resolveAuthorizedTenantId(UUID explicitTenantIdForAdmin, String... allowedTenantRoles) {
        SessionPrincipal principal = requireAuthenticated();
        if (principal.hasPlatformRole("ADMIN")) {
            if (explicitTenantIdForAdmin == null) {
                throw new IllegalArgumentException("Platform ADMIN must specify target venue ID");
            }
            return explicitTenantIdForAdmin;
        }
        if (explicitTenantIdForAdmin != null) {
            if (!principal.hasTenantRole(explicitTenantIdForAdmin, allowedTenantRoles)) {
                throw new ForbiddenAccessException("Access denied for venue: " + explicitTenantIdForAdmin);
            }
            return explicitTenantIdForAdmin;
        }
        return principal.firstTenantIdForRole(allowedTenantRoles)
                .orElseThrow(() -> new ForbiddenAccessException("No authorized venue role found in session"));
    }
}

