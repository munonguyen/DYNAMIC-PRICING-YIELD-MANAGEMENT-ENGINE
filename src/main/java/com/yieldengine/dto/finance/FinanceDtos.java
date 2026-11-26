package com.yieldengine.dto.finance;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class FinanceDtos {

    private FinanceDtos() {
    }

    public record CreateCommissionRuleRequest(
            UUID tenantId,
            Short sportTypeId,
            @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal ratePercent,
            String commissionBasis,
            Boolean appliesToForfeit,
            @NotNull Instant effectiveFrom,
            @NotNull Instant effectiveTo
    ) {
    }

    public record ReconciliationReportResponse(
            UUID tenantId,
            Instant fromTime,
            Instant toTime,
            long totalGatewayDebits,
            long totalEscrowCredits,
            long totalPlatformCommission,
            long totalVenuePayable,
            long totalCustomerRefunds,
            long totalForfeitedDeposits,
            boolean doubleEntryBalanced
    ) {
    }
}

