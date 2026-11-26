package com.yieldengine.controller;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.dto.request.ResourceGroupRequest;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.entity.TimeSlot;
import com.yieldengine.security.AuthContext;
import com.yieldengine.security.RbacGuard;
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

@Tag(name = "1A. Inventory & Listing Publishing", description = "Manage court groups, physical courts, publishing state, and time slots")
@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "Create a court group and auto-generate physical courts (UC-07)")
    @PostMapping("/groups")
    public ResponseEntity<ResourceGroup> createResourceGroup(@Valid @RequestBody ResourceGroupRequest request) {
        if (AuthContext.current().isPresent()) {
            UUID authorizedTenantId = rbacGuard.resolveAuthorizedTenantId(request.getTenantId(), SystemConstant.ROLE_MANAGER);
            request.setTenantId(authorizedTenantId);
        }
        ResourceGroup group = inventoryService.createResourceGroup(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(group);
    }

    @Operation(summary = "Get court group details by ID")
    @GetMapping("/groups/{id}")
    public ResponseEntity<ResourceGroup> getResourceGroup(@PathVariable UUID id) {
        return ResponseEntity.ok(inventoryService.getResourceGroup(id));
    }

    @Operation(summary = "Publish a court group to Marketplace listings (MANAGER - UC-08)")
    @PostMapping("/groups/{id}/publish")
    public ResponseEntity<ResourceGroup> publishGroup(@PathVariable UUID id) {
        ResourceGroup group = inventoryService.getResourceGroup(id);
        if (AuthContext.current().isPresent()) {
            rbacGuard.requireTenantRoleOrAdmin(group.getTenant().getId(), SystemConstant.ROLE_MANAGER);
        }
        return ResponseEntity.ok(inventoryService.updatePublishStatus(id, true));
    }

    @Operation(summary = "Unpublish a court group from Marketplace listings (MANAGER - UC-08)")
    @PostMapping("/groups/{id}/unpublish")
    public ResponseEntity<ResourceGroup> unpublishGroup(@PathVariable UUID id) {
        ResourceGroup group = inventoryService.getResourceGroup(id);
        if (AuthContext.current().isPresent()) {
            rbacGuard.requireTenantRoleOrAdmin(group.getTenant().getId(), SystemConstant.ROLE_MANAGER);
        }
        return ResponseEntity.ok(inventoryService.updatePublishStatus(id, false));
    }

    @Operation(summary = "Generate a business time slot and snapshot initial dynamic price")
    @PostMapping("/slots")
    public ResponseEntity<TimeSlot> createTimeSlot(@Valid @RequestBody CreateTimeSlotRequest request) {
        TimeSlot slot = inventoryService.createTimeSlot(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(slot);
    }

    @Operation(summary = "Query time slots for a group within a time range")
    @GetMapping("/groups/{groupId}/slots")
    public ResponseEntity<List<TimeSlot>> getSlots(
            @PathVariable UUID groupId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end) {
        return ResponseEntity.ok(inventoryService.getSlots(groupId, start, end));
    }
}
