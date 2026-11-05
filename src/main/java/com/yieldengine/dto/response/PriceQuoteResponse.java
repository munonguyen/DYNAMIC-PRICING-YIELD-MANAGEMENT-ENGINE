package com.yieldengine.dto.response;

import com.yieldengine.dto.PricingAuditDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PriceQuoteResponse {
    private UUID groupId;
    private Instant slotStart;
    private Instant slotEnd;
    private Long currentPrice;
    private String priceLockToken;
    private UUID tokenJti;
    private String kid;
    private Instant expiresAt;
    private PricingAuditDto audit;
}
