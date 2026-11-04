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
public class HoldSlotResponse {
    private UUID reservationId;
    private UUID unitId;
    private String unitNumber;
    private UUID slotId;
    private String userId;
    private BigDecimal lockedPrice;
    private String status;
    private Instant holdExpiresAt;
}
