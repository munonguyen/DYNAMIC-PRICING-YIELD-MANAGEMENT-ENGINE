package com.yieldengine.record.admin;

import jakarta.validation.constraints.NotBlank;

public record AdminTenantStatusRequest(
        @NotBlank String status
) {
}

