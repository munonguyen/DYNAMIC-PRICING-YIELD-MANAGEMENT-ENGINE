package com.yieldengine.dto;

import jakarta.validation.constraints.NotNull;
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
public class CreateTimeSlotRequest {

    @NotNull(message = "groupId is required")
    private UUID groupId;

    @NotNull(message = "slotStart is required")
    private Instant slotStart;

    @NotNull(message = "slotEnd is required")
    private Instant slotEnd;

    private Integer totalCapacity;

    @Builder.Default
    private BigDecimal contextMultiplier = BigDecimal.valueOf(1.000);
}
