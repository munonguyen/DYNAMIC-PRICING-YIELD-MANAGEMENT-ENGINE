package com.yieldengine.record.finance;

import java.time.Instant;
import java.util.UUID;
public record ReconciliationReportResponse(
        UUID tenantId,
        Instant fromTime,
        Instant toTime,
        long totalGatewayDebits,
        long totalEscrowCredits,
        long totalPlatformCommission,
        long totalVenuePayable,
        long totalCustomerRefunds,
        long totalCustomerRefundsPending,
        long totalForfeitedDeposits,
        boolean doubleEntryBalanced
) {
}
