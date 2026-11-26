package com.yieldengine.controller.auth;

import com.yieldengine.record.auth.*;
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

@Tag(name = "[AUTH] Identity & Session", description = "Shared Registration, Login, Logout & Current User Profile across all roles")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AuthSessionController {

    private final AuthService authService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[PUBLIC] Register a new player account (UC-01)")
    @PostMapping("/auth/register")
    public ResponseEntity<UserSummaryResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @Operation(summary = "[PUBLIC] Login ACTIVE account and issue session token (UC-01)")
    @PostMapping("/auth/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @Operation(summary = "[AUTHENTICATED] Logout current session (UC-01)")
    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logout() {
        rbacGuard.requireAuthenticated();
        authService.logout();
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "[AUTHENTICATED] Get own profile and active role grants")
    @GetMapping("/users/me")
    public ResponseEntity<UserSummaryResponse> getMyProfile() {
        SessionPrincipal principal = rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(authService.getCurrentUserProfile(principal.userId()));
    }
}

