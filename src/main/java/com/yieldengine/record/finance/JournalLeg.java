package com.yieldengine.record.finance;

/**
 * Immutable double-entry ledger leg (DEBIT/CREDIT account entry).
 */
public record JournalLeg(
        String accountCode,
        String entryType,
        String direction,
        long amount
) {
}

