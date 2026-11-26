package com.yieldengine.record.marketplace;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
public record PolicyTierDto(
        @Min(0) int minHoursBefore,
        @Min(0) @Max(100) short refundPercent
) {
}
