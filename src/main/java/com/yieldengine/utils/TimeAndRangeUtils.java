package com.yieldengine.utils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

/**
 * Centralized time range, timezone, lead-time, and PostgreSQL tstzrange formatting utilities.
 */
public final class TimeAndRangeUtils {

    public static final String DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";
    private static final long DEFAULT_FUTURE_BUFFER_SECONDS = 3600L;

    private TimeAndRangeUtils() {
    }

    public static String toHalfOpenTstzRange(Instant start, Instant end) {
        return String.format("[\"%s\", \"%s\")", start, end);
    }

    public static ZoneId resolveZoneId(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return ZoneId.of(DEFAULT_TIMEZONE);
        }
        try {
            return ZoneId.of(timezone.trim());
        } catch (Exception e) {
            return ZoneId.of(DEFAULT_TIMEZONE);
        }
    }

    public static Instant resolveFromTimeOrEpoch(Instant fromTime) {
        return fromTime != null ? fromTime : Instant.EPOCH;
    }

    public static Instant resolveToTimeOrNowBuffer(Instant toTime) {
        return toTime != null ? toTime : Instant.now().plusSeconds(DEFAULT_FUTURE_BUFFER_SECONDS);
    }

    public static double exactHoursBetween(Instant from, Instant to) {
        return Duration.between(from, to).toMillis() / 3_600_000.0;
    }

    public static BigDecimal nonNegativeLeadHours(Instant calculationTime, Instant slotStart) {
        long seconds = Math.max(0L, Duration.between(calculationTime, slotStart).getSeconds());
        return BigDecimal.valueOf(seconds)
                .divide(BigDecimal.valueOf(3600), 2, RoundingMode.HALF_UP);
    }
}

