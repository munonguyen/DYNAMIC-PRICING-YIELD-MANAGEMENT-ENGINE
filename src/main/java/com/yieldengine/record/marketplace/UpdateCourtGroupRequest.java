package com.yieldengine.record.marketplace;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateCourtGroupRequest(
        @Min(1) Long basePrice,
        @Min(1) Long minPrice,
        @Min(1) Long maxPrice,
        @Min(0) @Max(100) Short depositPercent,
        @Pattern(regexp = "QR_STAFF|PIN_COUNTER|MANUAL") String checkinMode,
        @Size(max = 100) List<@Valid CourtAddOn> addOnServices
) {}
