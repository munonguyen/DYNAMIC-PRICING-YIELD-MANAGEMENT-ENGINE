package com.yieldengine.record.vnpay;

import java.util.UUID;
public record VnPayReturnVerificationResponse(
        String code,
        String message,
        boolean signatureValid,
        boolean paymentSucceeded,
        String txnRef,
        UUID reservationId,
        String reservationStatus,
        String transactionNo,
        String bankCode,
        String cardType,
        String payDate,
        String responseCode,
        String transactionStatus,
        long amountVnd
) {
}
