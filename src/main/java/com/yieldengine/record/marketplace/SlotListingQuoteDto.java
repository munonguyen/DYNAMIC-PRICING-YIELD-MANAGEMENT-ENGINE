package com.yieldengine.record.marketplace;

import java.time.Instant;
public record SlotListingQuoteDto(
        Instant slotStart,
        Instant slotEnd,
        int totalCapacity,
        int availableCourts,
        Long currentDynamicPrice
) {
}
