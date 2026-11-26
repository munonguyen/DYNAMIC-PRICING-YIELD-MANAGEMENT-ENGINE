package com.yieldengine.record.ops;

import java.time.Instant;
import java.util.UUID;
public record CancelBookingResponse(
        UUID reservationId,
        String status,
        long depositAmount,
        long refundAmount,
        long forfeitedAmount,
        int appliedRefundPercent,
        boolean venueInitiated,
        Instant cancelledAt
) {
}
