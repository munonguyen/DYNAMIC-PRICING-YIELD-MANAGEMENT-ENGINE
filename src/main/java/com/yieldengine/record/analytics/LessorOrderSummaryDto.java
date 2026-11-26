package com.yieldengine.record.analytics;

import java.util.UUID;
import java.time.Instant;
public record LessorOrderSummaryDto(
        String orderId,
        UUID reservationId,
        UUID groupId,
        String groupName,
        String venueName,
        String sportName,
        String unitNumber,
        String slotLabel,
        String customerName,
        String customerPhone,
        long courtPrice,
        long paidEscrow,
        long remainingAtVenue,
        String paymentGateway,
        String status,
        String createdAtLabel,
        Instant slotStart,
        Instant slotEnd
) {}
