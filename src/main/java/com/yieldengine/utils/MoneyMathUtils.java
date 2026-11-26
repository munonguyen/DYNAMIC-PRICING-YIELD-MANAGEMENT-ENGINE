package com.yieldengine.utils;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Deterministic monetary rounding, clamping, deposit, and commission math utilities (VND BIGINT).
 */
public final class MoneyMathUtils {

    private static final BigDecimal THOUSAND = BigDecimal.valueOf(1000);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private MoneyMathUtils() {
    }

    public static long roundToNearestThousandVnd(BigDecimal rawPrice) {
        return rawPrice
                .divide(THOUSAND, 0, RoundingMode.HALF_UP)
                .multiply(THOUSAND)
                .longValue();
    }

    public static long clampPrice(long price, long minPrice, long maxPrice) {
        return Math.min(maxPrice, Math.max(minPrice, price));
    }

    public static long roundAndClampPrice(BigDecimal rawPrice, long minPrice, long maxPrice) {
        return clampPrice(roundToNearestThousandVnd(rawPrice), minPrice, maxPrice);
    }

    /**
     * Computes floor(baseAmount * percent / 100) for deposit & refund calculations (FR-19, BR-PAY-02).
     */
    public static long floorPercentageAmount(long baseAmount, int percent) {
        if (baseAmount <= 0 || percent <= 0) {
            return 0L;
        }
        int clampedPercent = Math.min(100, Math.max(0, percent));
        return (baseAmount * clampedPercent) / 100L;
    }

    /**
     * Computes HALF_UP(baseAmount * ratePercent / 100) capped at baseAmount for commission calculations.
     */
    public static long halfUpPercentageCapped(long baseAmount, BigDecimal ratePercent) {
        if (baseAmount <= 0 || ratePercent == null || ratePercent.compareTo(BigDecimal.ZERO) <= 0) {
            return 0L;
        }
        long calculated = BigDecimal.valueOf(baseAmount)
                .multiply(ratePercent)
                .divide(HUNDRED, 0, RoundingMode.HALF_UP)
                .longValue();
        return Math.min(baseAmount, calculated);
    }
}

