package com.yieldengine.controller;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.auth.CreateStaffRequest;
import com.yieldengine.record.auth.UserSummaryResponse;
import com.yieldengine.record.marketplace.*;
import com.yieldengine.entity.CancellationPolicy;
import com.yieldengine.entity.SportType;
import com.yieldengine.entity.Tenant;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.service.AuthService;
import com.yieldengine.service.InventoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Tag(name = "1B. Marketplace Catalogue, Venues, Staff & Policies", description = "Sport types, Venue settings, Staff management, Cancellation policies & Discovery listings")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class MarketplaceCatalogueController {

    private final InventoryService inventoryService;
    private final AuthService authService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "List active sport types (Public - UC-04)")
    @GetMapping("/sport-types")
    public ResponseEntity<List<SportType>> listSportTypes() {
        return ResponseEntity.ok(inventoryService.listActiveSportTypes());
    }

    @Operation(summary = "Create new sport type (ADMIN - UC-04)")
    @PostMapping("/sport-types")
    public ResponseEntity<SportType> createSportType(@Valid @RequestBody CreateSportTypeRequest request) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.createSportType(request));
    }

    @Operation(summary = "Update venue profile, check-in mode & staff chat toggle (MANAGER - UC-05)")
    @PatchMapping("/tenants/{id}/settings")
    public ResponseEntity<Tenant> updateVenueSettings(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateVenueSettingsRequest request
    ) {
        rbacGuard.requireTenantRoleOrAdmin(id, SystemConstant.ROLE_MANAGER);
        return ResponseEntity.ok(inventoryService.updateVenueSettings(id, request));
    }

    @Operation(summary = "Create staff account for venue (MANAGER - UC-06)")
    @PostMapping("/tenants/{id}/staff")
    public ResponseEntity<UserSummaryResponse> createVenueStaff(
            @PathVariable UUID id,
            @Valid @RequestBody CreateStaffRequest request
    ) {
        SessionPrincipal actor = rbacGuard.requireTenantRoleOrAdmin(id, SystemConstant.ROLE_MANAGER);
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.createVenueStaff(id, request, actor));
    }

    @Operation(summary = "List active staff of venue (MANAGER - UC-06)")
    @GetMapping("/tenants/{id}/staff")
    public ResponseEntity<List<UserSummaryResponse>> listVenueStaff(@PathVariable UUID id) {
        rbacGuard.requireTenantRoleOrAdmin(id, SystemConstant.ROLE_MANAGER);
        return ResponseEntity.ok(authService.listVenueStaff(id));
    }

    @Operation(summary = "Create cancellation policy with refund tiers (MANAGER - UC-10)")
    @PostMapping("/cancellation-policies")
    public ResponseEntity<CancellationPolicy> createCancellationPolicy(
            @Valid @RequestBody CreateCancellationPolicyRequest request
    ) {
        UUID authorizedTenantId = rbacGuard.resolveAuthorizedTenantId(request.tenantId(), SystemConstant.ROLE_MANAGER);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryService.createCancellationPolicy(authorizedTenantId, request));
    }

    @Operation(summary = "List cancellation policies of venue")
    @GetMapping("/cancellation-policies")
    public ResponseEntity<List<CancellationPolicy>> listCancellationPolicies(@RequestParam(required = false) UUID tenantId) {
        UUID authorizedTenantId = rbacGuard.resolveAuthorizedTenantId(tenantId, SystemConstant.ROLE_MANAGER, SystemConstant.ROLE_STAFF);
        return ResponseEntity.ok(inventoryService.listCancellationPolicies(authorizedTenantId));
    }

    @Operation(summary = "Browse published court listings with dynamic prices & real availability (Public - UC-11)")
    @GetMapping("/listings")
    public ResponseEntity<List<PublishedListingResponse>> browseListings(
            @RequestParam(required = false) String sport,
            @RequestParam(required = false) UUID tenant,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
    ) {
        return ResponseEntity.ok(inventoryService.browsePublishedListings(sport, tenant, from, to));
    }
}

