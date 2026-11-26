package com.yieldengine.record.analytics;
public record DailyRevenuePointDto(
        String dateIso,
        String dayLabel,
        String fullDateLabel,
        long courtRevenue,
        long serviceRevenue,
        int bookingsCount,
        int occupancyPct
) {}
