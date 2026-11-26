package com.yieldengine.record.ops;
public record MoMoPaymentSessionResponse(
        String partnerCode,
        String orderId,
        String requestId,
        long amount,
        String payUrl,
        String qrCodeUrl,
        String deeplink,
        int resultCode,
        String message,
        boolean liveGatewayResponse
) {
}
