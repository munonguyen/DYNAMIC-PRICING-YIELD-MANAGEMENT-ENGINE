package com.yieldengine.dto.analytics;

import java.util.List;
import java.util.UUID;

public final class SearchAndAnalyticsDtos {

    private SearchAndAnalyticsDtos() {}

    public record DailyRevenuePointDto(
            String dateIso,
            String dayLabel,
            String fullDateLabel,
            long courtRevenue,
            long serviceRevenue,
            int bookingsCount,
            int occupancyPct
    ) {}

    public record HourlyOccupancyPointDto(
            String hourLabel,
            int occupancyPct,
            long avgPrice,
            String tier
    ) {}

    public record ChannelBreakdownDto(
            String label,
            int pct,
            long amount,
            String color
    ) {}

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

    public record LessorOrderSummaryDto(
            String orderId,
            UUID reservationId,
            UUID groupId,
            String groupName,
            String venueName,
            String sportName,
            String unitNumber,
            String slotLabel,
            String customerName,
            String customerPhone,
            long courtPrice,
            long paidEscrow,
            long remainingAtVenue,
            String paymentGateway,
            String status,
            String createdAtLabel
    ) {}

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

    public record CourtSearchResponse(
            String dataSource,
            long queryLatencyMs,
            long totalHits,
            List<CourtSearchResultDto> hits
    ) {}

    public record ReindexResponse(
            boolean elasticsearchReachable,
            int indexedBookings,
            int indexedCourts,
            long durationMs,
            String message
    ) {}
}

