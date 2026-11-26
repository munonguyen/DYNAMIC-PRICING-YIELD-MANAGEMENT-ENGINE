package com.yieldengine.controller.lessor;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.entity.CancellationPolicy;
import com.yieldengine.entity.Tenant;
import com.yieldengine.record.auth.CreateStaffRequest;
import com.yieldengine.record.auth.UserSummaryResponse;
import com.yieldengine.record.marketplace.CreateCancellationPolicyRequest;
import com.yieldengine.record.marketplace.UpdateVenueSettingsRequest;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.AuthService;
import com.yieldengine.service.InventoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "[ROLE: MANAGER] Venue Profile, Staff & Cancellation Policies", description = "Venue configuration, staff provisioning & cancellation refund policies for court lessors")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class LessorVenueSettingsController {

    private final InventoryService inventoryService;
    private final AuthService authService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[MANAGER] Update venue profile, check-in mode & staff chat toggle (UC-05)")
    @PatchMapping("/tenants/{id}/settings")
    public ResponseEntity<Tenant> updateVenueSettings(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateVenueSettingsRequest request
    ) {
        rbacGuard.requireTenantRoleOrAdmin(id, SystemConstant.ROLE_MANAGER);
        return ResponseEntity.ok(inventoryService.updateVenueSettings(id, request));
    }

    @Operation(summary = "[MANAGER] Create staff account for venue (UC-06)")
    @PostMapping("/tenants/{id}/staff")
    public ResponseEntity<UserSummaryResponse> createVenueStaff(
            @PathVariable UUID id,
            @Valid @RequestBody CreateStaffRequest request
    ) {
        SessionPrincipal actor = rbacGuard.requireTenantRoleOrAdmin(id, SystemConstant.ROLE_MANAGER);
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.createVenueStaff(id, request, actor));
    }

    @Operation(summary = "[MANAGER] List active staff of venue (UC-06)")
    @GetMapping("/tenants/{id}/staff")
    public ResponseEntity<List<UserSummaryResponse>> listVenueStaff(@PathVariable UUID id) {
        rbacGuard.requireTenantRoleOrAdmin(id, SystemConstant.ROLE_MANAGER);
        return ResponseEntity.ok(authService.listVenueStaff(id));
    }

    @Operation(summary = "[MANAGER] Create cancellation policy with refund tiers (UC-10)")
    @PostMapping("/cancellation-policies")
    public ResponseEntity<CancellationPolicy> createCancellationPolicy(
            @Valid @RequestBody CreateCancellationPolicyRequest request
    ) {
        UUID authorizedTenantId = rbacGuard.resolveAuthorizedTenantId(request.tenantId(), SystemConstant.ROLE_MANAGER);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryService.createCancellationPolicy(authorizedTenantId, request));
    }

    @Operation(summary = "[MANAGER / STAFF] List cancellation policies of venue")
    @GetMapping("/cancellation-policies")
    public ResponseEntity<List<CancellationPolicy>> listCancellationPolicies(
            @RequestParam(required = false) UUID tenantId
    ) {
        UUID authorizedTenantId = rbacGuard.resolveAuthorizedTenantId(
                tenantId, SystemConstant.ROLE_MANAGER, SystemConstant.ROLE_STAFF
        );
        return ResponseEntity.ok(inventoryService.listCancellationPolicies(authorizedTenantId));
    }
}

