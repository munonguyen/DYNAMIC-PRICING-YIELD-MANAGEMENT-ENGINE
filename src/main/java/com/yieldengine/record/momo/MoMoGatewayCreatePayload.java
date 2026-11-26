package com.yieldengine.record.momo;
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
