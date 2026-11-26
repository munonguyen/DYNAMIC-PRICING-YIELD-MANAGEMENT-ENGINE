package com.yieldengine.record.analytics;

import java.util.List;
import java.util.UUID;
public record AnalyticsDashboardResponse(
        String scope,
        UUID tenantId,
        String dataSource,
        long queryLatencyMs,
        long indexedDocuments,
        long grossRevenue,
        long escrowHeld,
        long commissionAmount,
        long withdrawableBalance,
        int totalBookings,
        int pendingCheckins,
        int avgOccupancyPct,
        List<DailyRevenuePointDto> dailyRevenue,
        List<HourlyOccupancyPointDto> hourlyOccupancy,
        List<ChannelBreakdownDto> channelBreakdown,
        List<CourtPerformanceDto> courtPerformance,
        List<LessorOrderSummaryDto> recentOrders
) {}
