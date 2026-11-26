package com.yieldengine.record.vnpay;
public record VnPayRefundResponse(
        String txnRef,
        String responseCode,
        String message,
        long refundAmountVnd,
        String transactionType,
        String status,
        boolean liveGatewayResponse
) {
}
