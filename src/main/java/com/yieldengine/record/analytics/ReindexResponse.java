package com.yieldengine.record.analytics;
public record ReindexResponse(
        boolean elasticsearchReachable,
        int indexedBookings,
        int indexedCourts,
        long durationMs,
        String message
) {}
