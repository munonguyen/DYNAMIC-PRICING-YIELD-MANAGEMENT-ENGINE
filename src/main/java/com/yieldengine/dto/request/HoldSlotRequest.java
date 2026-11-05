package com.yieldengine.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
public class HoldSlotRequest {

    private UUID tenantId;

    @NotNull(message = "groupId is required")
    private UUID groupId;

    @NotNull(message = "slotStart is required")
    private Instant slotStart;

    @NotBlank(message = "userId is required")
    private String userId;

    @NotBlank(message = "priceLockToken is required")
    private String priceLockToken;

    private String idempotencyKey;
}
