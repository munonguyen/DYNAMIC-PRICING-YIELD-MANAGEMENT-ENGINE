package com.yieldengine.record.ops;

import java.time.Instant;
import java.util.UUID;

public record BookingPaymentStatus(
        UUID reservationId,
        String reservationStatus,
        State paymentStatus,
        long paidAmount,
        long remainingAtVenue,
        Long requestedAmount,
        String provider,
        String providerReference,
        Instant verifiedAt
) {
    public enum State { NOT_STARTED, PENDING, FAILED, VERIFIED, NO_DEPOSIT, EXPIRED, UNVERIFIED, REVIEW_REQUIRED }
}
