package com.yieldengine.utils;

import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;

/**
 * Shared utility for querying authoritative PostgreSQL transaction/system clock (BR-CAN-04).
 */
public final class DbClockUtils {

    private DbClockUtils() {
    }

    public static Instant now(JdbcTemplate jdbcTemplate) {
        if (jdbcTemplate == null) {
            return Instant.now();
        }
        try {
            Instant dbNow = jdbcTemplate.queryForObject("SELECT NOW()", Instant.class);
            return dbNow != null ? dbNow : Instant.now();
        } catch (Exception e) {
            return Instant.now();
        }
    }
}

