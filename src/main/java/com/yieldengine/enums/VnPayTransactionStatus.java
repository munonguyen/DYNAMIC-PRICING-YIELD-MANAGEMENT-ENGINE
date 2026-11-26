package com.yieldengine.enums;

/**
 * Lifecycle states of a VNPAY payment gateway transaction.
 */
public enum VnPayTransactionStatus {
    PENDING,
    SUCCESS,
    FAILED,
    CANCELLED,
    REFUND_PENDING,
    REFUNDED;

    public boolean isFinalized() {
        return this == SUCCESS || this == CANCELLED || this == REFUND_PENDING || this == REFUNDED;
    }
}

