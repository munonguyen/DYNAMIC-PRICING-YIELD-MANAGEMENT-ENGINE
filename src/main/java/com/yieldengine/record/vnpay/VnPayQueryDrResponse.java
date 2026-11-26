package com.yieldengine.record.vnpay;
public record VnPayQueryDrResponse(
        String txnRef,
        String responseCode,
        String message,
        String transactionNo,
        String transactionStatus,
        long amountVnd,
        String bankCode,
        String payDate,
        boolean liveGatewayResponse
) {
}
