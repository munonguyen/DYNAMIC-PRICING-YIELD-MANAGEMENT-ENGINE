package com.yieldengine.record.analytics;

import java.util.UUID;
public record CourtSearchResultDto(
        UUID groupId,
        String groupCode,
        String groupName,
        UUID tenantId,
        String venueName,
        String venueAddress,
        String sportCode,
        String sportName,
        long basePrice,
        long minPrice,
        long maxPrice,
        short depositPercent,
        int slotMinutes,
        double score
) {}
