package com.yieldengine.record.marketplace;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CourtAddOn(
        @NotBlank @Size(max = 80) String id,
        @NotBlank @Size(max = 30) String sportCode,
        @NotBlank @Pattern(regexp = "DRINKS|EQUIPMENT|SUPPORT|FACILITY") String category,
        @NotBlank @Size(max = 160) String name,
        @Size(max = 800) String description,
        @NotBlank @Size(max = 40) String unitLabel,
        @Min(0) @Max(100000000) long unitPrice,
        @Min(1) @Max(1000) int maxQty,
        @Size(max = 500) String imageUrl,
        Boolean popular,
        Boolean enabled
) {}
