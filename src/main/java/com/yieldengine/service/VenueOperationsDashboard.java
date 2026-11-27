package com.yieldengine.service;

import com.yieldengine.utils.DbClockUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VenueOperationsDashboard {
    private static final ZoneId VENUE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final JdbcTemplate dbClock;
    private final NamedParameterJdbcTemplate jdbc;

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Snapshot load(UUID tenantId) {
        Instant asOf = DbClockUtils.now(dbClock);
        LocalDate today = asOf.atZone(VENUE_ZONE).toLocalDate();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate monthStart = today.withDayOfMonth(1);
        var parameters = new MapSqlParameterSource("tenant", tenantId)
                .addValue("now", Timestamp.from(asOf))
                .addValue("today", boundary(today))
                .addValue("week", boundary(monday))
                .addValue("month", boundary(monthStart))
                .addValue("revenueStart", boundary(monday.isBefore(monthStart) ? monday : monthStart))
                .addValue("weekEnd", boundary(monday.plusWeeks(1)))
                .addValue("monday", monday)
                .addValue("zone", VENUE_ZONE.getId());

        Revenue revenue = jdbc.queryForObject("""
                SELECT COALESCE(SUM(net) FILTER (WHERE verified_at >= :today), 0) AS today,
                       COALESCE(SUM(net) FILTER (WHERE verified_at >= :week), 0) AS week,
                       COALESCE(SUM(net) FILTER (WHERE verified_at >= :month), 0) AS month
                FROM (
                    SELECT gateway_verified_at AS verified_at,
                           CASE WHEN payment_type = 'REFUND' THEN -amount ELSE amount END AS net
                    FROM payments
                    WHERE tenant_id = :tenant AND status = 'SUCCESS'
                      AND gateway_verified_at IS NOT NULL
                      AND gateway_verified_at >= :revenueStart AND gateway_verified_at <= :now
                ) confirmed_payments
                """, parameters, (row, index) -> new Revenue(row.getLong("today"), row.getLong("week"), row.getLong("month")));

        List<DayActivity> activity = jdbc.query("""
                WITH days AS (
                    SELECT CAST(:monday AS date) + n AS day FROM generate_series(0, 6) AS n
                ), scheduled AS (
                    SELECT (slot_start AT TIME ZONE :zone)::date AS day, COUNT(*) AS total
                    FROM reservations
                    WHERE tenant_id = :tenant AND slot_start >= :week AND slot_start < :weekEnd
                      AND status IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW')
                    GROUP BY 1
                ), arrivals AS (
                    SELECT (checked_in_at AT TIME ZONE :zone)::date AS day, COUNT(*) AS total
                    FROM reservations
                    WHERE tenant_id = :tenant AND checked_in_at IS NOT NULL
                      AND checked_in_at >= :week AND checked_in_at <= :now
                    GROUP BY 1
                )
                SELECT days.day, COALESCE(scheduled.total, 0) AS scheduled, COALESCE(arrivals.total, 0) AS arrivals
                FROM days LEFT JOIN scheduled USING (day) LEFT JOIN arrivals USING (day)
                ORDER BY days.day
                """, parameters, (row, index) -> new DayActivity(row.getObject("day", LocalDate.class),
                row.getLong("scheduled"), row.getLong("arrivals")));

        return new Snapshot(asOf, today, revenue, activity);
    }

    private Timestamp boundary(LocalDate day) {
        return Timestamp.from(day.atStartOfDay(VENUE_ZONE).toInstant());
    }

    public record Snapshot(Instant updatedAt, LocalDate today, Revenue revenue, List<DayActivity> activity) {}
    public record Revenue(long today, long week, long month) {}
    public record DayActivity(LocalDate day, long scheduled, long arrivals) {}
}
