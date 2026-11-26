package com.yieldengine.service;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.dto.auth.AuthDtos.*;
import com.yieldengine.entity.Role;
import com.yieldengine.entity.User;
import com.yieldengine.entity.UserRole;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.exception.UnauthorizedException;
import com.yieldengine.repository.RoleRepository;
import com.yieldengine.repository.UserRepository;
import com.yieldengine.repository.UserRoleRepository;
import com.yieldengine.security.AuthContext;
import com.yieldengine.security.SessionPrincipal;
import com.yieldengine.security.SessionStorePort;
import com.yieldengine.utils.CommonTextAndPageUtils;
import com.yieldengine.validate.AuthAndRbacValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Duration SESSION_TTL = Duration.ofHours(12);

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final SessionStorePort sessionStore;
    private final LoginAttemptService loginAttemptService;
    private final AuditLogService auditLogService;
    private final AuthAndRbacValidator authValidator;

    @Transactional
    public UserSummaryResponse register(RegisterRequest request) {
        authValidator.validateUniqueRegistrationCredentials(request.username(), request.email());

        User user = createActiveUserEntity(
                request.username(), request.email(), request.password(),
                request.firstName(), request.lastName(), request.phone()
        );

        Role userRoleEntity = roleRepository.findByCode(SystemConstant.ROLE_USER)
                .orElseThrow(() -> new ResourceNotFoundException("Default USER role not seeded"));

        UserRole assignment = UserRole.builder()
                .user(user)
                .role(userRoleEntity)
                .roleScope(SystemConstant.SCOPE_PLATFORM)
                .tenantId(null)
                .build();
        userRoleRepository.save(assignment);

        auditLogService.record(
                user.getId(),
                SystemConstant.ROLE_USER,
                null,
                "USER_REGISTERED",
                "USER",
                user.getId().toString(),
                Map.of("username", user.getUsername())
        );

        return toSummary(user, List.of(assignment));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        Instant now = Instant.now();
        User user = userRepository.findByUsername(request.username().trim())
                .orElseThrow(() -> new UnauthorizedException(AuthAndRbacValidator.GENERIC_AUTH_ERROR));

        authValidator.validateUserEligibleForLogin(user, now);

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            loginAttemptService.recordFailedAttempt(user.getId(), now);
            throw new UnauthorizedException(AuthAndRbacValidator.GENERIC_AUTH_ERROR);
        }

        user.setFailedLoginAttempts((short) 0);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        userRepository.save(user);

        List<UserRole> activeRoles = userRoleRepository.findActiveByUserId(user.getId());
        List<SessionPrincipal.RoleGrant> grants = activeRoles.stream()
                .map(ur -> new SessionPrincipal.RoleGrant(
                        ur.getRole().getCode(),
                        ur.getRoleScope(),
                        ur.getTenantId()
                ))
                .toList();

        Instant expiresAt = now.plus(SESSION_TTL);
        SessionPrincipal principal = new SessionPrincipal(
                user.getId(),
                user.getUsername(),
                grants,
                now,
                expiresAt
        );
        String sessionToken = sessionStore.createSession(principal, SESSION_TTL);

        auditLogService.record(
                user.getId(),
                principal.primaryRoleCode(),
                null,
                "USER_LOGIN",
                "USER",
                user.getId().toString(),
                Map.of("rolesCount", grants.size())
        );

        List<RoleAssignmentDto> roleDtos = grants.stream()
                .map(g -> new RoleAssignmentDto(g.roleCode(), g.scope(), g.tenantId()))
                .toList();

        return new AuthResponse(
                sessionToken,
                expiresAt,
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName() + " " + user.getLastName(),
                roleDtos
        );
    }

    public void logout() {
        AuthContext.currentToken().ifPresent(sessionStore::deleteSession);
    }

    @Transactional
    public UserSummaryResponse changeAccountStatus(UUID targetUserId, String newStatus, SessionPrincipal actor) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + targetUserId));

        List<UserRole> activeRoles = userRoleRepository.findActiveByUserId(target.getId());
        boolean isTargetAdmin = activeRoles.stream()
                .anyMatch(ur -> SystemConstant.ROLE_ADMIN.equals(ur.getRole().getCode()));

        authValidator.validateAccountStatusTransition(target, newStatus, isTargetAdmin);

        String oldStatus = target.getStatus();
        target.setStatus(newStatus);
        if ("INACTIVE".equals(newStatus)) {
            target.setDeactivatedAt(Instant.now());
            target.setDeactivatedBy(actor.userId());
            sessionStore.revokeAllUserSessions(target.getId());
        } else {
            target.setDeactivatedAt(null);
            target.setDeactivatedBy(null);
            target.setFailedLoginAttempts((short) 0);
            target.setLockedUntil(null);
        }
        userRepository.save(target);

        auditLogService.record(
                actor.userId(),
                actor.primaryRoleCode(),
                null,
                "USER_STATUS_CHANGED",
                "USER",
                target.getId().toString(),
                Map.of("oldStatus", oldStatus, "newStatus", newStatus)
        );

        return toSummary(target, activeRoles);
    }

    @Transactional
    public UserSummaryResponse assignRole(UUID targetUserId, AssignRoleRequest request, SessionPrincipal actor) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + targetUserId));
        String roleCode = CommonTextAndPageUtils.normalizeUpperCode(request.roleCode());
        Role role = roleRepository.findByCode(roleCode)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + roleCode));

        authValidator.validateRoleScopeAndUniqueness(targetUserId, role, request.tenantId());

        UserRole assignment = UserRole.builder()
                .user(target)
                .role(role)
                .roleScope(role.getScope())
                .tenantId(request.tenantId())
                .grantedBy(actor.userId())
                .build();
        userRoleRepository.save(assignment);

        sessionStore.revokeAllUserSessions(targetUserId);

        auditLogService.record(
                actor.userId(),
                actor.primaryRoleCode(),
                request.tenantId(),
                "ROLE_GRANTED",
                "USER_ROLE",
                assignment.getId().toString(),
                Map.of("targetUserId", targetUserId.toString(), "roleCode", role.getCode())
        );

        return toSummary(target, userRoleRepository.findActiveByUserId(targetUserId));
    }

    @Transactional
    public UserSummaryResponse createVenueStaff(UUID tenantId, CreateStaffRequest request, SessionPrincipal managerActor) {
        authValidator.validateVenueExists(tenantId);
        authValidator.validateUniqueRegistrationCredentials(request.username(), request.email());

        User staffUser = createActiveUserEntity(
                request.username(), request.email(), request.password(),
                request.firstName(), request.lastName(), null
        );

        Role staffRole = roleRepository.findByCode(SystemConstant.ROLE_STAFF)
                .orElseThrow(() -> new ResourceNotFoundException("STAFF role not seeded"));

        UserRole assignment = UserRole.builder()
                .user(staffUser)
                .role(staffRole)
                .roleScope(SystemConstant.SCOPE_TENANT)
                .tenantId(tenantId)
                .grantedBy(managerActor.userId())
                .build();
        userRoleRepository.save(assignment);

        auditLogService.record(
                managerActor.userId(),
                managerActor.primaryRoleCode(),
                tenantId,
                "STAFF_CREATED",
                "USER",
                staffUser.getId().toString(),
                Map.of("username", staffUser.getUsername(), "tenantId", tenantId.toString())
        );

        return toSummary(staffUser, List.of(assignment));
    }

    @Transactional(readOnly = true)
    public List<UserSummaryResponse> listVenueStaff(UUID tenantId) {
        return userRoleRepository.findActiveByTenantId(tenantId).stream()
                .filter(ur -> SystemConstant.ROLE_STAFF.equals(ur.getRole().getCode()))
                .map(ur -> toSummary(ur.getUser(), List.of(ur)))
                .toList();
    }

    @Transactional(readOnly = true)
    public UserSummaryResponse getCurrentUserProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        return toSummary(user, userRoleRepository.findActiveByUserId(userId));
    }

    private User createActiveUserEntity(
            String username, String email, String rawPassword,
            String firstName, String lastName, String phone
    ) {
        User user = User.builder()
                .username(username.trim())
                .email(email.trim())
                .passwordHash(passwordEncoder.encode(rawPassword))
                .firstName(firstName.trim())
                .lastName(lastName.trim())
                .phone(phone)
                .status("ACTIVE")
                .failedLoginAttempts((short) 0)
                .build();
        return userRepository.save(user);
    }

    private UserSummaryResponse toSummary(User user, List<UserRole> roles) {
        List<RoleAssignmentDto> roleDtos = roles.stream()
                .map(r -> new RoleAssignmentDto(r.getRole().getCode(), r.getRoleScope(), r.getTenantId()))
                .toList();
        return new UserSummaryResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getStatus(),
                user.getLastLoginAt(),
                user.getDeactivatedAt(),
                roleDtos
        );
    }
}
