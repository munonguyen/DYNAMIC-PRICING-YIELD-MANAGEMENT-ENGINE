package com.yieldengine.controller.admin;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.auth.AdminCreateUserRequest;
import com.yieldengine.record.auth.AssignRoleRequest;
import com.yieldengine.record.auth.UserStatusUpdateRequest;
import com.yieldengine.record.auth.UserSummaryResponse;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "[ROLE: ADMIN] User Status & RBAC Role Assignment", description = "Activate/soft-delete accounts and assign platform or tenant-scoped roles")
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminIdentityRbacController {

    private final AuthService authService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[ADMIN] Create a new user account with platform or tenant role")
    @PostMapping
    public ResponseEntity<UserSummaryResponse> createUser(
            @Valid @RequestBody AdminCreateUserRequest request
    ) {
        SessionPrincipal admin = rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.adminCreateUser(request, admin));
    }

    @Operation(summary = "[ADMIN] Activate or Soft-Delete (INACTIVE) user account & revoke sessions (UC-02)")
    @PatchMapping("/{id}/status")
    public ResponseEntity<UserSummaryResponse> updateUserStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UserStatusUpdateRequest request
    ) {
        SessionPrincipal admin = rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.ok(authService.changeAccountStatus(id, request.status(), admin));
    }

    @Operation(summary = "[ADMIN] Assign platform or venue-scoped role to user (UC-03)")
    @PostMapping("/{id}/roles")
    public ResponseEntity<UserSummaryResponse> assignRole(
            @PathVariable UUID id,
            @Valid @RequestBody AssignRoleRequest request
    ) {
        SessionPrincipal admin = rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.assignRole(id, request, admin));
    }
}

