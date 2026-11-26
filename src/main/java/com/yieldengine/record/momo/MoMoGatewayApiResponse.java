package com.yieldengine.record.momo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
