package com.yieldengine.record.marketplace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;
public record CreateCancellationPolicyRequest(
        UUID tenantId,
        @NotBlank @Size(max = 100) String name,
        @NotEmpty List<PolicyTierDto> tiers
) {
}
