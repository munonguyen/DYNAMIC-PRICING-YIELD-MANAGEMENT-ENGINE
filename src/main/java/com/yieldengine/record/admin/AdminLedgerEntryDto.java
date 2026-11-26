package com.yieldengine.record.admin;

import java.time.Instant;
import java.util.UUID;

public record AdminLedgerEntryDto(
        UUID entryId,
        UUID journalId,
        UUID tenantId,
        String tenantName,
        UUID reservationId,
        String accountCode,
        String entryType,
        String direction,
        long amount,
        String currency,
        Instant occurredAt
) {
}

