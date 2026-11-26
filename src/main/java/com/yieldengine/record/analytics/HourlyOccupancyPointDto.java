package com.yieldengine.record.analytics;
public record HourlyOccupancyPointDto(
        String hourLabel,
        int occupancyPct,
        long avgPrice,
        String tier
) {}
