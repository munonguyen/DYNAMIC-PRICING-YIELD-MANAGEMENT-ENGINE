package com.yieldengine.record.ops;

import java.time.Instant;
import java.util.UUID;

public record BookingPaymentStatus(
        UUID reservationId,
        String reservationStatus,
        State paymentStatus,
        long paidAmount,
        long remainingAtVenue,
        Long requestedAmount,
        String provider,
        String providerReference,
        Instant verifiedAt,
        PaymentQr paymentQr
) {
    public record PaymentQr(String payload, Instant holdUntil, boolean sandbox, BankTransfer transfer) {}

    public record BankTransfer(String bankCode, String bankName, String bankAccount, String virtualAccount,
                               String accountName, String content) {}

    public enum State {
        NOT_STARTED, PENDING, FAILED, VERIFIED, NO_DEPOSIT, EXPIRED, CANCELLED, UNVERIFIED, REVIEW_REQUIRED,
        REFUND_PENDING, REFUNDED
    }
}
