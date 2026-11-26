package com.yieldengine.record.admin;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AdminCommissionRuleDto(
        UUID id,
        UUID tenantId,
        String tenantName,
        Short sportTypeId,
        String sportName,
        BigDecimal ratePercent,
        String commissionBasis,
        boolean appliesToForfeit,
        String effectivePeriod,
        String status,
        Instant createdAt
) {
}

