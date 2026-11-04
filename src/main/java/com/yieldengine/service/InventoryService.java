package com.yieldengine.service;

import com.yieldengine.dto.CreateTimeSlotRequest;
import com.yieldengine.dto.ResourceGroupRequest;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.entity.TimeSlot;
import com.yieldengine.entity.Unit;
import com.yieldengine.entity.UnitStatus;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.repository.ResourceGroupRepository;
import com.yieldengine.repository.TimeSlotRepository;
import com.yieldengine.repository.UnitRepository;
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

    private final ResourceGroupRepository resourceGroupRepository;
    private final UnitRepository unitRepository;
    private final TimeSlotRepository timeSlotRepository;
    private final PricingEngineService pricingEngineService;

    @Transactional
    public ResourceGroup createResourceGroup(ResourceGroupRequest request) {
        ResourceGroup group = ResourceGroup.builder()
                .code(request.getCode())
                .name(request.getName())
                .totalUnits(request.getTotalUnits())
                .basePrice(request.getBasePrice())
                .minPrice(request.getMinPrice())
                .maxPrice(request.getMaxPrice())
                .build();

        group = resourceGroupRepository.save(group);

        // Auto-generate physical units
        List<Unit> units = new ArrayList<>();
        for (int i = 1; i <= request.getTotalUnits(); i++) {
            String unitNumber = String.format("SAN_%02d", i);
            Unit unit = Unit.builder()
                    .resourceGroup(group)
                    .unitNumber(unitNumber)
                    .status(UnitStatus.ACTIVE)
                    .build();
            units.add(unit);
        }
        unitRepository.saveAll(units);

        log.info("Created ResourceGroup {} with {} units", group.getCode(), group.getTotalUnits());
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
                : group.getTotalUnits();

        TimeSlot timeSlot = TimeSlot.builder()
                .resourceGroup(group)
                .slotStart(request.getSlotStart())
                .slotEnd(request.getSlotEnd())
                .totalCapacity(capacity)
                .reservedCount(0)
                .contextMultiplier(request.getContextMultiplier())
                .build();

        timeSlot = timeSlotRepository.save(timeSlot);

        // Snapshot initial price
        pricingEngineService.recalculateAndSnapshot(timeSlot);

        return timeSlot;
    }

    @Transactional(readOnly = true)
    public List<TimeSlot> getSlots(UUID groupId, Instant start, Instant end) {
        return timeSlotRepository.findSlotsInRange(groupId, start, end);
    }
}
