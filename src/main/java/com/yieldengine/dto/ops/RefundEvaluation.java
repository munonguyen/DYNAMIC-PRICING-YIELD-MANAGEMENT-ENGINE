package com.yieldengine.dto.ops;

/**
 * Immutable evaluation outcome of cancellation refund and deposit forfeit policy calculation.
 */
public record RefundEvaluation(
        long refundAmount,
        long forfeitedAmount,
        int appliedRefundPercent,
        double hoursBeforeStart,
        String reasonCode
) {
}
