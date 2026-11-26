package com.yieldengine.record.ops;

import java.time.Instant;
import java.util.UUID;
public record QrCodeResponse(
        UUID reservationId,
        UUID qrJti,
        String qrToken,
        Instant expiresAt
) {
}
