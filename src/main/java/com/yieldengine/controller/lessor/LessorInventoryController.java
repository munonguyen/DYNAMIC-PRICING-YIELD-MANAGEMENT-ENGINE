package com.yieldengine.controller.lessor;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.dto.request.ResourceGroupRequest;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.entity.TimeSlot;
import com.yieldengine.record.marketplace.PublishedListingResponse;
import com.yieldengine.record.marketplace.UpdateCourtGroupRequest;
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

@Tag(name = "[ROLE: MANAGER] Court Groups, Slots & Publishing", description = "Create court groups, manage time slots and toggle marketplace visibility")
@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
public class LessorInventoryController {

    private final InventoryService inventoryService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[MANAGER] Create a court group and auto-generate physical courts (UC-07)")
    @PostMapping("/groups")
    public ResponseEntity<ResourceGroup> createResourceGroup(@Valid @RequestBody ResourceGroupRequest request) {
        request.setTenantId(rbacGuard.resolveAuthorizedTenantId(request.getTenantId(), SystemConstant.ROLE_MANAGER));
        ResourceGroup group = inventoryService.createResourceGroup(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(group);
    }

    @GetMapping("/groups")
    public List<PublishedListingResponse> listManagedGroups(@RequestParam(required = false) UUID tenantId) {
        return inventoryService.listManagedGroups(rbacGuard.resolveAuthorizedTenantId(
                tenantId, SystemConstant.ROLE_MANAGER, SystemConstant.ROLE_STAFF));
    }

    @PatchMapping("/groups/{id}/settings")
    public ResponseEntity<Void> updateGroup(@PathVariable UUID id, @Valid @RequestBody UpdateCourtGroupRequest request) {
        requireGroupManager(id);
        inventoryService.updateGroup(id, request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "[MANAGER / PUBLIC] Get court group details by ID")
    @GetMapping("/groups/{id}")
    public ResponseEntity<ResourceGroup> getResourceGroup(@PathVariable UUID id) {
        return ResponseEntity.ok(inventoryService.getVisibleResourceGroup(id));
    }

    @Operation(summary = "[MANAGER] Publish a court group to Marketplace listings (UC-08)")
    @PostMapping("/groups/{id}/publish")
    public ResponseEntity<ResourceGroup> publishGroup(@PathVariable UUID id) {
        requireGroupManager(id);
        return ResponseEntity.ok(inventoryService.updatePublishStatus(id, true));
    }

    @Operation(summary = "[MANAGER] Unpublish a court group from Marketplace listings (UC-08)")
    @PostMapping("/groups/{id}/unpublish")
    public ResponseEntity<ResourceGroup> unpublishGroup(@PathVariable UUID id) {
        requireGroupManager(id);
        return ResponseEntity.ok(inventoryService.updatePublishStatus(id, false));
    }

    @Operation(summary = "[MANAGER] Generate a business time slot and snapshot initial dynamic price")
    @PostMapping("/slots")
    public ResponseEntity<TimeSlot> createTimeSlot(@Valid @RequestBody CreateTimeSlotRequest request) {
        requireGroupManager(request.getGroupId());
        TimeSlot slot = inventoryService.createTimeSlot(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(slot);
    }

    @Operation(summary = "[MANAGER / PUBLIC] Query time slots for a group within a time range")
    @GetMapping("/groups/{groupId}/slots")
    public ResponseEntity<List<TimeSlot>> getSlots(
            @PathVariable UUID groupId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end
    ) {
        inventoryService.getVisibleResourceGroup(groupId);
        return ResponseEntity.ok(inventoryService.getSlots(groupId, start, end));
    }

    private void requireGroupManager(UUID groupId) {
        rbacGuard.requireAuthenticated();
        ResourceGroup group = inventoryService.getResourceGroup(groupId);
        rbacGuard.requireTenantRoleOrAdmin(group.getTenant().getId(), SystemConstant.ROLE_MANAGER);
    }
}

