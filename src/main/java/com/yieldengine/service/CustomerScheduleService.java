package com.yieldengine.service;

import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.record.ops.CustomerScheduleResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomerScheduleService {
    private static final ZoneId VENUE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public CustomerScheduleResponse load(UUID customerId, LocalDate referenceDate) {
        LocalDate date = referenceDate == null ? LocalDate.now(VENUE_ZONE) : referenceDate;
        LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        var bookings = jdbc.query("""
                SELECT r.id, r.slot_start, LEAST(r.hold_expires_at, r.slot_start) AS hold_until,
                       t.name AS venue_name, t.address AS venue_address,
                       g.name AS group_name, u.unit_number,
                       COALESCE(s.slot_end, r.slot_start + make_interval(mins => g.slot_minutes)) AS slot_end,
                       CASE WHEN r.status = 'HELD' AND LEAST(r.hold_expires_at, r.slot_start) <= CURRENT_TIMESTAMP
                            THEN 'EXPIRED' ELSE r.status END AS effective_status
                FROM reservations r
                JOIN resource_groups g ON g.id = r.group_id
                JOIN tenants t ON t.id = r.tenant_id
                JOIN units u ON u.id = r.unit_id
                LEFT JOIN time_slots s ON s.group_id = r.group_id AND s.slot_start = r.slot_start
                WHERE r.user_id = ? AND r.slot_start >= ? AND r.slot_start < ?
                ORDER BY r.slot_start, r.id
                """, (row, index) -> {
            var status = ReservationStatus.valueOf(row.getString("effective_status"));
            return new CustomerScheduleResponse.Booking(
                    row.getObject("id", UUID.class), row.getString("venue_name"), row.getString("venue_address"),
                    row.getString("group_name"), row.getString("unit_number"),
                    row.getTimestamp("slot_start").toInstant(), row.getTimestamp("slot_end").toInstant(), status,
                    status == ReservationStatus.HELD ? row.getTimestamp("hold_until").toInstant() : null);
        }, customerId, startOfDay(monday), startOfDay(monday.plusWeeks(1)));
        return new CustomerScheduleResponse(monday, bookings);
    }

    private static Timestamp startOfDay(LocalDate date) {
        return Timestamp.from(date.atStartOfDay(VENUE_ZONE).toInstant());
    }
}
