package com.yieldengine.service;

import com.yieldengine.record.analytics.LessorOrderSummaryDto;
import com.yieldengine.utils.DbClockUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VenueCourtStatusService {
    private static final ZoneId VENUE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final JdbcTemplate jdbc;
    private final SearchAndAnalyticsSyncService orders;

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Snapshot load(UUID tenantId) {
        Instant asOf = DbClockUtils.now(jdbc);
        LocalDate today = asOf.atZone(VENUE_ZONE).toLocalDate();
        List<LessorOrderSummaryDto> bookings = orders.loadVenueOrdersForDay(tenantId,
                today.atStartOfDay(VENUE_ZONE).toInstant(),
                today.plusDays(1).atStartOfDay(VENUE_ZONE).toInstant(), asOf);

        Map<CourtKey, CurrentBooking> currentBookings = new HashMap<>();
        for (LessorOrderSummaryDto order : bookings) {
            if (order.slotStart().isAfter(asOf) || !asOf.isBefore(order.slotEnd())) continue;
            CourtStatus status = switch (order.status()) {
                case "COMPLETED" -> CourtStatus.RENTED;
                case "CONFIRMED" -> CourtStatus.AWAITING_CHECK_IN;
                case "HELD" -> CourtStatus.PAYMENT_HOLD;
                default -> null;
            };
            if (status == null) continue;
            currentBookings.merge(new CourtKey(order.groupId(), order.unitNumber()),
                    new CurrentBooking(order.reservationId(), status),
                    (first, next) -> first.status().compareTo(next.status()) <= 0 ? first : next);
        }

        List<Court> courts = jdbc.query("""
                SELECT u.id, u.group_id, u.unit_number, g.name AS group_name,
                       u.status <> 'ACTIVE' OR g.publish_status <> 'PUBLISHED' OR EXISTS (
                           SELECT 1 FROM unit_time_locks utl
                           WHERE utl.unit_id = u.id AND utl.tenant_id = u.tenant_id
                             AND utl.kind = 'MAINTENANCE' AND utl.period @> CAST(? AS timestamptz)
                       ) AS unavailable
                FROM units u
                JOIN resource_groups g ON g.id = u.group_id AND g.tenant_id = u.tenant_id
                WHERE u.tenant_id = ? AND u.status <> 'RETIRED'
                  AND g.status = 'ACTIVE' AND g.deleted_at IS NULL
                ORDER BY g.name, g.id, u.unit_number
                """, (row, index) -> {
            UUID groupId = row.getObject("group_id", UUID.class);
            String unit = row.getString("unit_number");
            CurrentBooking current = currentBookings.get(new CourtKey(groupId, unit));
            CourtStatus status = current == null
                    ? (row.getBoolean("unavailable") ? CourtStatus.UNAVAILABLE : CourtStatus.AVAILABLE)
                    : current.status();
            return new Court(row.getObject("id", UUID.class), groupId, row.getString("group_name"),
                    unit, status, current == null ? null : current.reservationId());
        }, Timestamp.from(asOf), tenantId);

        return new Snapshot(tenantId, asOf, today, courts, bookings);
    }

    public enum CourtStatus { RENTED, AWAITING_CHECK_IN, PAYMENT_HOLD, UNAVAILABLE, AVAILABLE }

    private record CourtKey(UUID groupId, String unitNumber) {}
    private record CurrentBooking(UUID reservationId, CourtStatus status) {}
    public record Court(UUID id, UUID groupId, String groupName, String unitNumber,
                        CourtStatus status, UUID reservationId) {}
    public record Snapshot(UUID tenantId, Instant updatedAt, LocalDate today,
                           List<Court> courts, List<LessorOrderSummaryDto> bookings) {}
}
