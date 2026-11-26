package com.yieldengine.validate;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.entity.Role;
import com.yieldengine.entity.User;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.exception.UnauthorizedException;
import com.yieldengine.repository.TenantRepository;
import com.yieldengine.repository.UserRepository;
import com.yieldengine.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Validator for Identity, Authentication, Soft-Delete, and Multi-Scope RBAC rules (FR-01..09, NFR-02, NFR-15).
 */
@Component
@RequiredArgsConstructor
public class AuthAndRbacValidator {

    public static final String GENERIC_AUTH_ERROR = "Invalid credentials or account is not active";

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final TenantRepository tenantRepository;

    public void validateUniqueRegistrationCredentials(String username, String email) {
        if (userRepository.existsByUsername(username.trim())) {
            throw new BusinessConflictException("Username is already taken");
        }
        if (userRepository.existsByEmail(email.trim())) {
            throw new BusinessConflictException("Email is already registered");
        }
    }

    public void validateUserEligibleForLogin(User user, Instant now) {
        if (!user.isActive()) {
            throw new UnauthorizedException(GENERIC_AUTH_ERROR);
        }
        if (user.isTemporarilyLocked(now)) {
            throw new UnauthorizedException("Account is temporarily locked due to multiple failed login attempts");
        }
    }

    public void validateAccountStatusTransition(User target, String newStatus, boolean isTargetAdmin) {
        if (!"ACTIVE".equals(newStatus) && !"INACTIVE".equals(newStatus)) {
            throw new IllegalArgumentException("Account status must be ACTIVE or INACTIVE");
        }
        if ("INACTIVE".equals(newStatus) && isTargetAdmin && target.isActive()) {
            if (userRoleRepository.countActiveAdmins() <= 1) {
                throw new BusinessConflictException("Cannot deactivate the last active platform ADMIN");
            }
        }
    }

    public void validateRoleScopeAndUniqueness(UUID targetUserId, Role role, UUID tenantId) {
        if (SystemConstant.SCOPE_TENANT.equals(role.getScope()) && tenantId == null) {
            throw new IllegalArgumentException("Tenant-scoped role " + role.getCode() + " requires a venue tenantId");
        }
        if (SystemConstant.SCOPE_PLATFORM.equals(role.getScope()) && tenantId != null) {
            throw new IllegalArgumentException("Platform-scoped role " + role.getCode() + " must not specify tenantId");
        }
        if (tenantId != null && !tenantRepository.existsById(tenantId)) {
            throw new ResourceNotFoundException("Venue (tenant) not found: " + tenantId);
        }
        if (userRoleRepository.findActiveAssignment(targetUserId, role.getCode(), tenantId).isPresent()) {
            throw new BusinessConflictException("User already holds active role " + role.getCode() + " in this scope");
        }
    }

    public void validateVenueExists(UUID tenantId) {
        if (!tenantRepository.existsById(tenantId)) {
            throw new ResourceNotFoundException("Venue not found: " + tenantId);
        }
    }
}

