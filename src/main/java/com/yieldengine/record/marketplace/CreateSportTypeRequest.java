package com.yieldengine.record.marketplace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record CreateSportTypeRequest(
        @NotBlank @Size(max = 30) String code,
        @NotBlank @Size(max = 100) String name
) {
}
