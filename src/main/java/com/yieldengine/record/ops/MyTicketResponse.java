package com.yieldengine.record.ops;

import java.time.Instant;
import java.util.UUID;
public record MyTicketResponse(
        UUID reservationId,
        String venueName,
        String venueAddress,
        String groupName,
        String unitNumber,
        Instant slotStart,
        Instant slotEnd,
        String status,
        long lockedPrice,
        long depositAmount,
        long paidOnlineAmount,
        long remainingAtVenue,
        String contactEmail,
        UUID qrJti,
        String qrToken,
        Instant qrExpiresAt,
        String checkinMode,
        String checkinPinCode
) {
}
