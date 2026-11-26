package com.yieldengine.record.ops;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;
public record VerifyPinRequest(
        @NotNull UUID reservationId,
        @NotBlank @Size(min = 4, max = 12) String pinCode,
        @Size(max = 6) String phoneLast4
) {
}
