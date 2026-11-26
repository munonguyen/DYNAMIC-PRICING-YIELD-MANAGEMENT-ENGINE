package com.yieldengine.record.marketplace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
public record ReviewLessorApplicationRequest(
        @NotBlank @Pattern(regexp = "APPROVED|REJECTED") String decision,
        @NotBlank @Size(min = 5, max = 500) String reviewNote
) {
}
