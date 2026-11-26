package com.yieldengine.record.ops;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;
public record MoMoIpnCallbackRequest(
        String partnerCode,
        @NotBlank String orderId,
        @NotBlank String requestId,
        @NotNull Long amount,
        String orderInfo,
        String orderType,
        @NotNull Long transId,
        @NotNull Integer resultCode,
        String message,
        String payType,
        @NotNull Long responseTime,
        String extraData,
        @NotBlank String signature,
        UUID reservationId
) {
}
