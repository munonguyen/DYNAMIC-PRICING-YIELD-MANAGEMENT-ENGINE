package com.yieldengine.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PriceQuoteResponse {
    private UUID slotId;
    private UUID groupId;
    private Instant slotStart;
    private Instant slotEnd;
    private BigDecimal currentPrice;
    private String priceLockToken;
    private UUID tokenJti;
    private Instant expiresAt;
    private PricingAuditDto audit;
}
