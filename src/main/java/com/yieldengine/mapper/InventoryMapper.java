package com.yieldengine.mapper;

import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.dto.request.ResourceGroupRequest;
import com.yieldengine.entity.*;
import org.mapstruct.Builder;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.Instant;
import java.util.UUID;

@Mapper(componentModel = "spring", builder = @Builder(disableBuilder = true))
public interface InventoryMapper {

    default SlotId toSlotId(UUID groupId, Instant slotStart) {
        return new SlotId(groupId, slotStart);
    }

    @Mapping(target = "tenant", source = "tenant")
    @Mapping(target = "sportType", source = "sportType")
    @Mapping(target = "cancellationPolicy", source = "policy")
    @Mapping(target = "code", source = "request.code")
    @Mapping(target = "name", source = "request.name")
    @Mapping(target = "slotMinutes", expression = "java(request.getSlotMinutes() != null ? request.getSlotMinutes() : 60)")
    @Mapping(target = "holdTtlSeconds", expression = "java(request.getHoldTtlSeconds() != null ? request.getHoldTtlSeconds() : 600)")
    @Mapping(target = "basePrice", source = "request.basePrice")
    @Mapping(target = "minPrice", source = "request.minPrice")
    @Mapping(target = "maxPrice", source = "request.maxPrice")
    @Mapping(target = "timezone", expression = "java(request.getTimezone() != null ? request.getTimezone() : \"Asia/Ho_Chi_Minh\")")
    @Mapping(target = "currency", constant = "VND")
    @Mapping(target = "publishStatus", constant = "DRAFT")
    @Mapping(target = "depositPercent", expression = "java(request.getDepositPercent() != null ? request.getDepositPercent() : (short) 0)")
    @Mapping(target = "noshowGraceMinutes", expression = "java(request.getNoshowGraceMinutes() != null ? request.getNoshowGraceMinutes() : 15)")
    @Mapping(target = "balancePaymentMode", constant = "AT_VENUE")
    @Mapping(target = "status", constant = "ACTIVE")
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "version", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    ResourceGroup toResourceGroup(ResourceGroupRequest request, Tenant tenant, SportType sportType, CancellationPolicy policy);

    @Mapping(target = "id", expression = "java(toSlotId(group.getId(), request.getSlotStart()))")
    @Mapping(target = "tenantId", source = "group.tenant.id")
    @Mapping(target = "slotEnd", source = "request.slotEnd")
    @Mapping(target = "totalCapacity", source = "capacity")
    @Mapping(target = "contextMultiplier", source = "request.contextMultiplier")
    @Mapping(target = "status", constant = "OPEN")
    @Mapping(target = "createdAt", ignore = true)
    TimeSlot toTimeSlot(CreateTimeSlotRequest request, ResourceGroup group, int capacity);

    @Mapping(target = "id", expression = "java(toSlotId(group.getId(), request.getSlotStart()))")
    @Mapping(target = "tenantId", source = "group.tenant.id")
    @Mapping(target = "heldCount", constant = "0")
    @Mapping(target = "confirmedCount", constant = "0")
    @Mapping(target = "totalCapacity", source = "capacity")
    @Mapping(target = "version", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    SlotInventory toSlotInventory(CreateTimeSlotRequest request, ResourceGroup group, int capacity);
}
