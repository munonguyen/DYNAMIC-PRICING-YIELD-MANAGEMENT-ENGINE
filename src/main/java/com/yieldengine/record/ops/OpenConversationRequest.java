package com.yieldengine.record.ops;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;
public record OpenConversationRequest(
        @NotNull UUID tenantId,
        UUID bookingId
) {
}
