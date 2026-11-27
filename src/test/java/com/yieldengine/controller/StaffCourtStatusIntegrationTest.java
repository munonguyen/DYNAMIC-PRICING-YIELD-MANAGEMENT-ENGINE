package com.yieldengine.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.record.security.RoleGrant;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.SessionStorePort;
import com.yieldengine.utils.DbClockUtils;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional(isolation = Isolation.REPEATABLE_READ)
class StaffCourtStatusIntegrationTest {
    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID GROUP = UUID.fromString("a0000000-0000-0000-0000-000000000001");
    private static final String URL = "/api/v1/checkins/court-status";

    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SessionStorePort sessions;

    @Test
    void usesTheActualSlotWindowAndVenueScope() throws Exception {
        Instant now = DbClockUtils.now(jdbc);
        var vietnamDate = now.atZone(ZoneId.of("Asia/Ho_Chi_Minh"));
        Instant todayStart = vietnamDate.toLocalDate().atStartOfDay(vietnamDate.getZone()).toInstant();
        Instant tomorrowStart = vietnamDate.toLocalDate().plusDays(1).atStartOfDay(vietnamDate.getZone()).toInstant();
        UUID rented = createUnit();
        UUID ended = createUnit();
        UUID waiting = createUnit();
        UUID held = createUnit();
        UUID expired = createUnit();
        UUID future = createUnit();
        UUID unavailable = createUnit();

        UUID overnight = addBooking(rented, "COMPLETED", todayStart.minusSeconds(60), now.plusSeconds(1800), null);
        addBooking(ended, "COMPLETED", now.minusSeconds(3600), now, null);
        addBooking(waiting, "CONFIRMED", now, now.plusSeconds(1800), null);
        addBooking(held, "HELD", now.minusSeconds(180), now.plusSeconds(1800), now.plusSeconds(300));
        UUID expiredBooking = addBooking(expired, "HELD", now.minusSeconds(240), now.plusSeconds(1800), now.minusSeconds(60));
        UUID tomorrow = addBooking(future, "CONFIRMED", tomorrowStart, tomorrowStart.plusSeconds(1800), null);
        jdbc.update("""
                INSERT INTO unit_time_locks (id, tenant_id, unit_id, period, kind)
                VALUES (?, ?, ?, tstzrange(?, ?, '[)'), 'MAINTENANCE')
                """, UUID.randomUUID(), TENANT, unavailable, Timestamp.from(now.minusSeconds(60)), Timestamp.from(now.plusSeconds(60)));

        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(get(URL).header("Authorization", bearer("USER", "PLATFORM", null)))
                .andExpect(status().isForbidden());
        var staff = bearer("STAFF", "TENANT", TENANT);
        mvc.perform(get(URL).param("tenantId", UUID.randomUUID().toString()).header("Authorization", staff))
                .andExpect(status().isForbidden());
        mvc.perform(get(URL).header("Authorization", bearer("MANAGER", "TENANT", TENANT)))
                .andExpect(status().isOk());

        String body = mvc.perform(get(URL).header("Authorization", staff))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsString();
        JsonNode snapshot = json.readTree(body);
        assertEquals(vietnamDate.toLocalDate().toString(), snapshot.path("today").asText());
        assertEquals("RENTED", court(snapshot, rented).path("status").asText());
        assertEquals(overnight.toString(), court(snapshot, rented).path("reservationId").asText());
        assertEquals("AVAILABLE", court(snapshot, ended).path("status").asText());
        assertEquals("AWAITING_CHECK_IN", court(snapshot, waiting).path("status").asText());
        assertEquals("PAYMENT_HOLD", court(snapshot, held).path("status").asText());
        assertEquals("AVAILABLE", court(snapshot, expired).path("status").asText());
        assertEquals("AVAILABLE", court(snapshot, future).path("status").asText());
        assertEquals("UNAVAILABLE", court(snapshot, unavailable).path("status").asText());
        assertTrue(body.contains(overnight.toString()));
        assertFalse(body.contains(expiredBooking.toString()));
        assertFalse(body.contains(tomorrow.toString()));
    }

    private String bearer(String role, String scope, UUID tenantId) {
        Instant now = Instant.now();
        var principal = new SessionPrincipal(UUID.randomUUID(), "court-status-test",
                List.of(new RoleGrant(role, scope, tenantId)), now, now.plusSeconds(120));
        return "Bearer " + sessions.createSession(principal, Duration.ofMinutes(2));
    }

    private UUID createUnit() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO units (id, tenant_id, group_id, unit_number) VALUES (?, ?, ?, ?)",
                id, TENANT, GROUP, "TEST_" + id.toString().substring(0, 12));
        return id;
    }

    private UUID addBooking(UUID unit, String status, Instant start, Instant end, Instant holdExpiry) {
        jdbc.update("""
                INSERT INTO time_slots (group_id, slot_start, tenant_id, slot_end, total_capacity) VALUES (?, ?, ?, ?, 1)
                ON CONFLICT (group_id, slot_start) DO NOTHING
                """, GROUP, Timestamp.from(start), TENANT, Timestamp.from(end));
        UUID reservation = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO reservations (id, slot_start, tenant_id, group_id, unit_id, status, locked_price,
                                          pricing_audit, hold_expires_at, checked_in_at)
                VALUES (?, ?, ?, ?, ?, ?, 100000, '{}'::jsonb, ?, ?)
                """, reservation, Timestamp.from(start), TENANT, GROUP, unit, status,
                holdExpiry == null ? null : Timestamp.from(holdExpiry),
                "COMPLETED".equals(status) ? Timestamp.from(start) : null);
        return reservation;
    }

    private JsonNode court(JsonNode snapshot, UUID id) {
        for (JsonNode row : snapshot.path("courts")) {
            if (id.toString().equals(row.path("id").asText())) return row;
        }
        return fail("Missing court " + id);
    }
}
