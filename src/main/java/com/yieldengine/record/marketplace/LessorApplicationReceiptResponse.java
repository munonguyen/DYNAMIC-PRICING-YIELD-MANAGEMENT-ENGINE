package com.yieldengine.record.marketplace;

import java.time.Instant;
import java.util.UUID;
public record LessorApplicationReceiptResponse(
        UUID id,
        String referenceCode,
        String venueName,
        String legalEntityName,
        String status,
        Instant createdAt
) {
}
