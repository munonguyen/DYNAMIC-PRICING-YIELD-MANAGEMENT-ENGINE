package com.yieldengine.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HoldSlotRequest {

    @NotNull(message = "slotId is required")
    private UUID slotId;

    @NotBlank(message = "userId is required")
    private String userId;

    @NotBlank(message = "priceLockToken is required")
    private String priceLockToken;
}
