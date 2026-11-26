package com.yieldengine.controller;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.auth.*;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "0. Identity, Auth & RBAC Admin", description = "Registration, Redis-backed Login/Logout, Soft Delete & Multi-Scope Role Management")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AuthAndUserController {

    private final AuthService authService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "Register a new player account (UC-01)")
    @PostMapping("/auth/register")
    public ResponseEntity<UserSummaryResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @Operation(summary = "Login ACTIVE account and issue Redis session token (UC-01)")
    @PostMapping("/auth/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @Operation(summary = "Logout current session from Redis (UC-01)")
    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logout() {
        rbacGuard.requireAuthenticated();
        authService.logout();
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Get own profile and active role grants")
    @GetMapping("/users/me")
    public ResponseEntity<UserSummaryResponse> getMyProfile() {
        SessionPrincipal principal = rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(authService.getCurrentUserProfile(principal.userId()));
    }

    @Operation(summary = "Activate or Soft-Delete (INACTIVE) user account & revoke Redis sessions (UC-02)")
    @PatchMapping("/admin/users/{id}/status")
    public ResponseEntity<UserSummaryResponse> updateUserStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UserStatusUpdateRequest request
    ) {
        SessionPrincipal admin = rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.ok(authService.changeAccountStatus(id, request.status(), admin));
    }

    @Operation(summary = "Assign platform or venue-scoped role to user (UC-03)")
    @PostMapping("/admin/users/{id}/roles")
    public ResponseEntity<UserSummaryResponse> assignRole(
            @PathVariable UUID id,
            @Valid @RequestBody AssignRoleRequest request
    ) {
        SessionPrincipal admin = rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.assignRole(id, request, admin));
    }
}

