package com.yieldengine.dto.response;

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
public class HoldSlotResponse {
    private UUID reservationId;
    private UUID unitId;
    private String unitNumber;
    private UUID groupId;
    private Instant slotStart;
    private String userId;
    private Long lockedPrice;
    private String status;
    private Instant holdExpiresAt;
}
