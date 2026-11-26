package com.yieldengine.record.ops;

import java.time.Instant;
import java.util.UUID;
public record QrInspectResponse(
        boolean valid,
        String verdictCode,
        String verdictMessage,
        boolean signatureValid,
        boolean notExpired,
        boolean venueMatched,
        boolean unusedAntiReplay,
        UUID reservationId,
        UUID qrJti,
        String unitNumber,
        String groupName,
        Instant slotStart,
        Instant slotEnd,
        String customerName,
        String customerPhoneMasked,
        String customerEmail,
        long totalPrice,
        long paidAmount,
        long remainingAtVenue,
        String status,
        Instant previousScannedAt
) {
}
