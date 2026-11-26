package com.yieldengine.record.analytics;
public record ChannelBreakdownDto(
        String label,
        int pct,
        long amount,
        String color
) {}
