package com.yieldengine.dto.ops;

import java.time.Instant;
import java.util.UUID;

/**
 * Immutable domain snapshot representing a customer's pass credentials and payment summary.
 */
public record TicketPassSnapshot(
        UUID reservationId,
        UUID qrJti,
        String qrToken,
        String checkinPinCode,
        String checkinMode,
        String venueName,
        String venueAddress,
        String groupName,
        String unitNumber,
        Instant slotStart,
        Instant slotEnd,
        Instant qrExpiresAt,
        long lockedPrice,
        long paidAmount,
        long remainingAtVenue,
        String customerName,
        String customerPhoneMasked,
        String customerPhoneLast4,
        String customerEmail
) {
}
