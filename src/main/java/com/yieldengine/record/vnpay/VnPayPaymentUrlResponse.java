package com.yieldengine.record.vnpay;

import java.util.UUID;
public record VnPayPaymentUrlResponse(
        String code,
        String message,
        String paymentUrl,
        String txnRef,
        UUID reservationId,
        long amountVnd,
        long vnpAmount,
        String createDate,
        String expireDate,
        String status
) {
}
