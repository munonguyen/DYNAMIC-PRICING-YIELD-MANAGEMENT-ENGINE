package com.yieldengine.service;

import com.yieldengine.record.ops.MyTicketResponse;
import com.yieldengine.utils.CommonTextAndPageUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomerTicketReadService {
    private static final String HISTORY_FILTER = """
            AND (r.status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED') OR EXISTS (
                SELECT 1 FROM payments p
                WHERE p.booking_id = r.booking_id AND p.payment_type <> 'REFUND'
            ))
            """;

    private static final String QUERY = """
            WITH reservation_page AS (
                SELECT r.id, r.tenant_id, r.group_id, r.unit_id, r.booking_id, r.slot_start,
                       r.status, r.locked_price, r.deposit_amount, r.qr_jti, r.pin_consumed_at
                FROM reservations r
                WHERE r.user_id = :userId
                %s
                ORDER BY r.slot_start DESC, r.id DESC
                LIMIT :size OFFSET :offset
            )
            SELECT r.*, b.contact_email, u.unit_number, g.name AS group_name, t.name AS venue_name,
                   t.address AS venue_address, g.slot_minutes, g.noshow_grace_minutes,
                   COALESCE(NULLIF(BTRIM(g.checkin_mode), ''), t.checkin_mode, 'QR_STAFF') AS checkin_mode,
                   amounts.paid, amounts.escrow, attempt.provider, attempt.provider_ref,
                   CASE WHEN attempt.status = 'SUCCESS' THEN attempt.gateway_verified_at END AS paid_at
            FROM reservation_page r
            LEFT JOIN bookings b ON b.id = r.booking_id
            LEFT JOIN units u ON u.id = r.unit_id
            LEFT JOIN resource_groups g ON g.id = r.group_id
            LEFT JOIN tenants t ON t.id = g.tenant_id
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(p.amount) FILTER (
                           WHERE p.payment_type <> 'REFUND'
                               AND (p.gateway_verified_at IS NOT NULL OR p.payment_type = 'BALANCE')
                       ), 0) AS paid,
                       COALESCE(SUM(p.amount) FILTER (
                           WHERE p.payment_type IN ('DEPOSIT', 'FULL_SETTLEMENT', 'BALANCE')
                               AND p.gateway_verified_at IS NOT NULL
                       ), 0) AS escrow
                FROM payments p
                WHERE p.booking_id = r.booking_id AND p.status = 'SUCCESS'
            ) amounts ON true
            LEFT JOIN LATERAL (
                SELECT p.provider, p.provider_ref, p.status, p.gateway_verified_at
                FROM payments p
                WHERE p.booking_id = r.booking_id AND p.payment_type <> 'REFUND'
                ORDER BY (p.status = 'SUCCESS' AND p.gateway_verified_at IS NOT NULL) DESC,
                         p.created_at DESC, p.id DESC
                LIMIT 1
            ) attempt ON true
            ORDER BY r.slot_start DESC, r.id DESC
            """;

    private final NamedParameterJdbcTemplate jdbc;
    private final TicketPassService ticketPassService;
    private final PriceLockTokenService priceLockTokenService;

    @Transactional(readOnly = true)
    public List<MyTicketResponse> listTickets(UUID userId, UUID reservationId, int page, int size) {
        if (reservationId != null) {
            return read(userId, "AND r.id = :reservationId",
                    new MapSqlParameterSource("reservationId", reservationId), 0, 1);
        }
        return list(userId, "", page, size);
    }

    @Transactional(readOnly = true)
    public List<MyTicketResponse> listPaymentHistory(UUID userId, int page, int size) {
        return list(userId, HISTORY_FILTER, page, size);
    }

    private List<MyTicketResponse> list(UUID userId, String filter, int page, int size) {
        var bounds = CommonTextAndPageUtils.boundedPageable(page, size, 100);
        return read(userId, filter, new MapSqlParameterSource(), bounds.getOffset(), bounds.getPageSize());
    }

    private List<MyTicketResponse> read(UUID userId, String filter, MapSqlParameterSource parameters, long offset, int size) {
        parameters.addValue("userId", userId).addValue("offset", offset).addValue("size", size);
        return jdbc.query(QUERY.formatted(filter), parameters, (row, index) -> toTicket(row));
    }

    private MyTicketResponse toTicket(ResultSet row) throws SQLException {
        UUID id = row.getObject("id", UUID.class);
        UUID qrJti = row.getObject("qr_jti", UUID.class);
        var start = row.getTimestamp("slot_start").toInstant();
        var end = start.plus(Duration.ofMinutes(row.getObject("slot_minutes", Integer.class) == null
                ? 60 : row.getInt("slot_minutes")));
        var expires = end.plus(Duration.ofMinutes(row.getObject("noshow_grace_minutes", Integer.class) == null
                ? 15 : row.getInt("noshow_grace_minutes")));
        long price = row.getLong("locked_price");
        long deposit = row.getLong("deposit_amount");
        long paid = row.getLong("paid");
        String status = row.getString("status");
        String mode = row.getString("checkin_mode");
        boolean canIssuePass = qrJti != null && "CONFIRMED".equals(status)
                && (deposit == 0 || row.getLong("escrow") > 0);
        boolean pinOnly = "PIN_COUNTER".equalsIgnoreCase(mode) || "MANUAL".equalsIgnoreCase(mode);
        String token = canIssuePass && !pinOnly ? ticketPassService.signQrToken(
                qrJti, row.getObject("tenant_id", UUID.class), id, start, expires) : null;
        String pin = canIssuePass && row.getTimestamp("pin_consumed_at") == null
                ? priceLockTokenService.deriveCheckInPin(id, qrJti) : null;
        var paidAt = row.getTimestamp("paid_at");
        return new MyTicketResponse(id, fallback(row.getString("venue_name"), "ArenaPulse Sports Complex"),
                fallback(row.getString("venue_address"), ""), fallback(row.getString("group_name"), "Cụm sân thể thao"),
                fallback(row.getString("unit_number"), "SAN_01"), start, end, status, price, deposit, paid,
                Math.max(0, price - paid), row.getString("contact_email"), qrJti, token, expires, mode, pin,
                row.getString("provider"), row.getString("provider_ref"), paidAt == null ? null : paidAt.toInstant());
    }

    private String fallback(String value, String fallback) {
        return value == null ? fallback : value;
    }
}
