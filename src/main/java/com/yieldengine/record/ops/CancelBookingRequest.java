package com.yieldengine.record.ops;

import jakarta.validation.constraints.Size;

import java.time.Instant;
public record CancelBookingRequest(
        Instant slotStart,
        @Size(max = 100) String reason
) {
}
