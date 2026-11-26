package com.yieldengine.record.marketplace;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record OtpChallengeRequest(
        @NotBlank @Size(min = 10, max = 20) String contactPhone,
        @NotBlank @Email String contactEmail
) {
}
