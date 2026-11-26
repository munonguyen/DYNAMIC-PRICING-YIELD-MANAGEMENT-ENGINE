package com.yieldengine.record.admin;

import java.time.Instant;
import java.util.UUID;

public record AdminTenantOverviewDto(
        UUID id,
        String code,
        String name,
        String address,
        String phone,
        String checkinMode,
        boolean staffChatEnabled,
        String status,
        Instant createdAt,
        int groupCount,
        int publishedGroupCount,
        long unitCount,
        long reservationCount,
        long grossRevenueVnd,
        double commissionRatePercent
) {
}

