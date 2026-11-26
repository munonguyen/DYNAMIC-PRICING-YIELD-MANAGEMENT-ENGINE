package com.yieldengine.record.auth;

import jakarta.validation.constraints.NotBlank;
public record LoginRequest(
        @NotBlank String username,
        @NotBlank String password
) {
}
