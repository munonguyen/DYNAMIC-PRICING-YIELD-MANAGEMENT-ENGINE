package com.yieldengine.record.ops;

import java.time.Instant;
import java.util.UUID;
public record CheckInResponse(
        UUID checkInId,
        UUID reservationId,
        UUID tenantId,
        String method,
        String reservationStatus,
        Instant scannedAt
) {
}
