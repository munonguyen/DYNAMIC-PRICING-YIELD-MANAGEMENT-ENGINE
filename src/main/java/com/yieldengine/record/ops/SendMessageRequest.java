package com.yieldengine.record.ops;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record SendMessageRequest(
        @NotBlank @Size(min = 1, max = 4000) String body
) {
}
