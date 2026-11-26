package com.yieldengine.dto.momo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Strongly-typed DTOs for MoMo PayGate v2 HTTP request/response serialization and domain outputs.
 */
public final class MoMoGatewayDtos {

    private MoMoGatewayDtos() {
    }

    public record MoMoGatewayCreatePayload(
            String partnerCode,
            String partnerName,
            String storeId,
            String requestId,
            long amount,
            String orderId,
            String orderInfo,
            String redirectUrl,
            String ipnUrl,
            String lang,
            String extraData,
            String requestType,
            boolean autoCapture,
            String signature
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MoMoGatewayApiResponse(
            String partnerCode,
            String orderId,
            String requestId,
            Long amount,
            Integer resultCode,
            String message,
            String payUrl,
            String qrCodeUrl,
            String deeplink,
            String applink,
            String signature
    ) {
    }

    public record MoMoPaymentInitResult(
            String partnerCode,
            String orderId,
            String requestId,
            long amount,
            String payUrl,
            String qrCodeUrl,
            String deeplink,
            int resultCode,
            String message,
            boolean liveGatewayResponse,
            String signature,
            String rawSignatureBase
    ) {
    }
}

