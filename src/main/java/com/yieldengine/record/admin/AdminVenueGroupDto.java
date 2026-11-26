package com.yieldengine.record.admin;

import java.util.UUID;

public record AdminVenueGroupDto(
        UUID groupId,
        UUID tenantId,
        String tenantName,
        String code,
        String name,
        String sportCode,
        String sportName,
        long basePrice,
        long minPrice,
        long maxPrice,
        short depositPercent,
        int slotMinutes,
        String publishStatus,
        long unitCount,
        long reservationCount
) {
}

