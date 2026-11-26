package com.yieldengine.record.auth;

import jakarta.validation.constraints.NotBlank;
public record UserStatusUpdateRequest(
        @NotBlank String status
) {
}
