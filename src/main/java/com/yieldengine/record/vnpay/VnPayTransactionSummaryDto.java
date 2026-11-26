package com.yieldengine.record.vnpay;

import java.time.Instant;
import java.util.UUID;
public record VnPayTransactionSummaryDto(
        UUID id,
        UUID reservationId,
        UUID bookingId,
        String txnRef,
        long amountVnd,
        long vnpAmount,
        String bankCode,
        String cardType,
        String transactionNo,
        String responseCode,
        String transactionStatus,
        String payDate,
        String status,
        boolean secureHashValid,
        Instant createdAt,
        Instant updatedAt
) {
}
