package com.yieldengine.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.record.security.RoleGrant;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.SessionStorePort;
import com.yieldengine.service.InventoryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class CourtUnitSelectionIntegrationTest {
    private static final UUID GROUP = UUID.fromString("a0000000-0000-0000-0000-000000000001");
    private static final String AVAILABILITY = "/api/v1/listings/" + GROUP + "/court-availability";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired InventoryService inventory;
    @Autowired SessionStorePort sessions;

    @Test
    void aSelectedCourtIsExclusiveAndRetryUsesTheExactAssignment() throws Exception {
        Instant slotStart = Instant.now().truncatedTo(ChronoUnit.MILLIS).plus(Duration.ofDays(2));
        inventory.createTimeSlot(CreateTimeSlotRequest.builder().groupId(GROUP).slotStart(slotStart)
                .slotEnd(slotStart.plus(Duration.ofHours(1))).totalCapacity(10).build());
        JsonNode courts = availability(slotStart);
        assertTrue(courts.size() >= 3);
        UUID first = UUID.fromString(courts.get(0).path("id").asText());
        UUID second = UUID.fromString(courts.get(1).path("id").asText());
        assertEquals("AVAILABLE", courtStatus(courts, second));
        Actor one = actor();
        Actor two = actor();
        var oneRequest = quote(one, slotStart, second);
        var twoRequest = quote(two, slotStart, second);
        MockHttpServletResponse resultOne;
        MockHttpServletResponse resultTwo;
        var concurrent = Executors.newFixedThreadPool(2);
        try {
            var futureOne = concurrent.submit(() -> hold(one, oneRequest));
            var futureTwo = concurrent.submit(() -> hold(two, twoRequest));
            resultOne = futureOne.get();
            resultTwo = futureTwo.get();
        } finally {
            concurrent.shutdownNow();
        }
        assertTrue(resultOne.getStatus() == 201 || resultTwo.getStatus() == 201);
        Actor winner = resultOne.getStatus() == 201 ? one : two;
        Actor loser = winner == one ? two : one;
        Map<String, Object> winningRequest = winner == one ? oneRequest : twoRequest;
        Map<String, Object> losingRequest = winner == one ? twoRequest : oneRequest;
        MockHttpServletResponse winningResult = winner == one ? resultOne : resultTwo;
        assertEquals(409, (winner == one ? resultTwo : resultOne).getStatus());
        JsonNode booking = json.readTree(winningResult.getContentAsByteArray());
        assertEquals(second.toString(), booking.path("unitId").asText());
        assertEquals(booking.path("reservationId"), json.readTree(hold(winner, winningRequest).getContentAsByteArray()).path("reservationId"));
        assertEquals("TAKEN", courtStatus(availability(slotStart), second));

        winningRequest.put("unitId", first);
        assertEquals(422, hold(winner, winningRequest).getStatus());
        losingRequest.put("unitId", UUID.randomUUID());
        assertEquals(409, hold(loser, losingRequest).getStatus());
        losingRequest.put("unitId", first);
        var alternative = hold(loser, losingRequest);
        assertEquals(201, alternative.getStatus());
        assertEquals(first.toString(), json.readTree(alternative.getContentAsByteArray()).path("unitId").asText());

        Actor autoUser = actor();
        var autoResponse = hold(autoUser, quote(autoUser, slotStart, null));
        assertEquals(201, autoResponse.getStatus());
        assertNotEquals(second.toString(), json.readTree(autoResponse.getContentAsByteArray()).path("unitId").asText());
    }

    private JsonNode availability(Instant slotStart) throws Exception {
        byte[] result = mvc.perform(get(AVAILABILITY).param("slotStart", slotStart.toString())).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse().getContentAsByteArray();
        return json.readTree(result).path("courts");
    }

    private String courtStatus(JsonNode courts, UUID unitId) {
        for (JsonNode court : courts) if (unitId.toString().equals(court.path("id").asText())) return court.path("status").asText();
        return fail("Missing court " + unitId);
    }

    private Actor actor() {
        Instant now = Instant.now();
        UUID id = UUID.randomUUID();
        var principal = new SessionPrincipal(id, "court-choice-test", List.of(new RoleGrant("USER", "PLATFORM", null)), now, now.plusSeconds(120));
        return new Actor(id, "Bearer " + sessions.createSession(principal, Duration.ofMinutes(2)));
    }

    private Map<String, Object> quote(Actor actor, Instant start, UUID unit) throws Exception {
        byte[] quote = mvc.perform(get("/api/v1/pricing/quote").header("Authorization", actor.bearer())
                .param("groupId", GROUP.toString()).param("slotStart", start.toString())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("groupId", GROUP);
        body.put("slotStart", start.toString());
        body.put("userId", actor.id().toString());
        body.put("priceLockToken", json.readTree(quote).path("priceLockToken").asText());
        body.put("idempotencyKey", UUID.randomUUID().toString());
        if (unit != null) body.put("unitId", unit);
        return body;
    }

    private MockHttpServletResponse hold(Actor actor, Map<String, Object> body) throws Exception {
        return mvc.perform(post("/api/v1/bookings/hold").header("Authorization", actor.bearer()).contentType("application/json")
                .content(json.writeValueAsBytes(body))).andReturn().getResponse();
    }

    private record Actor(UUID id, String bearer) {}
}
