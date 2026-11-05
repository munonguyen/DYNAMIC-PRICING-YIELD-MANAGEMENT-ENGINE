package com.yieldengine.service;

import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.dto.request.ResourceGroupRequest;
import com.yieldengine.entity.*;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final TenantRepository tenantRepository;
    private final ResourceGroupRepository resourceGroupRepository;
    private final UnitRepository unitRepository;
    private final TimeSlotRepository timeSlotRepository;
    private final SlotInventoryRepository slotInventoryRepository;
    private final PricingEngineService pricingEngineService;

    @Transactional
    public ResourceGroup createResourceGroup(ResourceGroupRequest request) {
        UUID tenantId = request.getTenantId();
        Tenant tenant;
        if (tenantId != null) {
            tenant = tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Tenant not found: " + tenantId));
        } else {
            tenant = tenantRepository.findAll().stream().findFirst()
                    .orElseGet(() -> tenantRepository.save(Tenant.builder()
                            .code("DEFAULT_TENANT")
                            .name("Default System Tenant")
                            .status("ACTIVE")
                            .build()));
        }

        ResourceGroup group = ResourceGroup.builder()
                .tenant(tenant)
                .code(request.getCode())
                .name(request.getName())
                .slotMinutes(request.getSlotMinutes() != null ? request.getSlotMinutes() : 60)
                .holdTtlSeconds(request.getHoldTtlSeconds() != null ? request.getHoldTtlSeconds() : 600)
                .basePrice(request.getBasePrice())
                .minPrice(request.getMinPrice())
                .maxPrice(request.getMaxPrice())
                .status("ACTIVE")
                .build();

        group = resourceGroupRepository.save(group);

        // Auto-generate physical units
        List<Unit> units = new ArrayList<>();
        for (int i = 1; i <= request.getTotalUnits(); i++) {
            String unitNumber = String.format("SAN_%02d", i);
            Unit unit = Unit.builder()
                    .tenantId(tenant.getId())
                    .resourceGroup(group)
                    .unitNumber(unitNumber)
                    .status("ACTIVE")
                    .build();
            units.add(unit);
        }
        unitRepository.saveAll(units);

        log.info("Created ResourceGroup {} with {} units for tenant {}", group.getCode(), request.getTotalUnits(), tenant.getCode());
        return group;
    }

    @Transactional(readOnly = true)
    public ResourceGroup getResourceGroup(UUID id) {
        return resourceGroupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found: " + id));
    }

    @Transactional
    public TimeSlot createTimeSlot(CreateTimeSlotRequest request) {
        ResourceGroup group = getResourceGroup(request.getGroupId());
        int capacity = (request.getTotalCapacity() != null && request.getTotalCapacity() > 0)
                ? request.getTotalCapacity()
                : 10;

        SlotId slotId = new SlotId(group.getId(), request.getSlotStart());

        TimeSlot timeSlot = TimeSlot.builder()
                .id(slotId)
                .tenantId(group.getTenant().getId())
                .slotEnd(request.getSlotEnd())
                .totalCapacity(capacity)
                .contextMultiplier(request.getContextMultiplier())
                .status("OPEN")
                .build();

        timeSlot = timeSlotRepository.save(timeSlot);

        // Initialize slot_inventory
        SlotInventory inventory = SlotInventory.builder()
                .id(slotId)
                .tenantId(group.getTenant().getId())
                .heldCount(0)
                .confirmedCount(0)
                .totalCapacity(capacity)
                .build();
        slotInventoryRepository.save(inventory);

        // Snapshot initial price
        pricingEngineService.recalculateAndSnapshot(timeSlot);

        return timeSlot;
    }

    @Transactional(readOnly = true)
    public List<TimeSlot> getSlots(UUID groupId, Instant start, Instant end) {
        return timeSlotRepository.findSlotsInRange(groupId, start, end);
    }
}
