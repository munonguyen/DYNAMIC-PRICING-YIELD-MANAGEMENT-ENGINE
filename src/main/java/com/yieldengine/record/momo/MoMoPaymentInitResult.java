package com.yieldengine.record.momo;
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
