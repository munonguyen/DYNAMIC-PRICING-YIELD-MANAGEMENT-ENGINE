package com.yieldengine.record.analytics;

import java.util.UUID;
public record CourtPerformanceDto(
        UUID groupId,
        String groupName,
        String sportCode,
        String sportName,
        long basePrice,
        int bookingsCount,
        int occupancyPct,
        long totalRevenue
) {}
