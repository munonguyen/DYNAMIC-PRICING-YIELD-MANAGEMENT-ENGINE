package com.yieldengine.record.ops;

import com.yieldengine.enums.ReservationStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CustomerScheduleResponse(LocalDate weekStart, List<Booking> bookings) {
    public record Booking(
            UUID reservationId,
            String venueName,
            String venueAddress,
            String groupName,
            String unitNumber,
            Instant slotStart,
            Instant slotEnd,
            ReservationStatus status,
            Instant holdExpiresAt
    ) {}
}
