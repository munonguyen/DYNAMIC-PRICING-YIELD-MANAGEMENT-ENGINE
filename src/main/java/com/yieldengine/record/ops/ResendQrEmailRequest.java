package com.yieldengine.record.ops;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
public record ResendQrEmailRequest(
        @NotBlank @Email String recipientEmail
) {
}
