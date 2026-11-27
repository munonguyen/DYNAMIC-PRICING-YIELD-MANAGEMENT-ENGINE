package com.yieldengine.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.record.security.RoleGrant;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.SessionStorePort;
import com.yieldengine.service.CourtFloorPlanService.CourtPlacement;
import com.yieldengine.service.CourtFloorPlanService.Draft;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional(isolation = Isolation.REPEATABLE_READ)
class CourtFloorPlanIntegrationTest {
    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID GROUP = UUID.fromString("a0000000-0000-0000-0000-000000000001");
    private static final String URL = "/api/v1/inventory/groups/" + GROUP + "/floor-plan";

    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SessionStorePort sessions;

    @Test
    void onlyTheOwnerCanSaveAndStaffReceivesTheSameLayout() throws Exception {
        jdbc.update("DELETE FROM court_floor_plans WHERE group_id = ?", GROUP);
        String manager = bearer("MANAGER", TENANT);
        String staff = bearer("STAFF", TENANT);
        String outsider = bearer("MANAGER", UUID.randomUUID());

        mvc.perform(get(URL).header("Authorization", outsider)).andExpect(status().isNotFound());
        mvc.perform(get(URL).header("Authorization", staff)).andExpect(status().isForbidden());
        byte[] editor = mvc.perform(get(URL).header("Authorization", manager))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        JsonNode units = json.readTree(editor).path("units");
        assertTrue(units.size() >= 2);
        List<CourtPlacement> placements = new ArrayList<>();
        for (int index = 0; index < units.size(); index++) {
            UUID id = UUID.fromString(units.get(index).path("id").asText());
            placements.add(new CourtPlacement(id, "Sân " + (index + 1), index * 800, 0, 750, 1200));
        }
        Draft first = new Draft(units.size() * 800, 1300, 0, placements);
        save(staff, first).andExpect(status().isForbidden());
        save(manager, first).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        save(manager, new Draft(first.widthCm(), 1750, 1, placements)).andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2)).andExpect(jsonPath("$.lengthCm").value(1750));

        mvc.perform(get(URL).header("Authorization", manager)).andExpect(status().isOk())
                .andExpect(jsonPath("$.layout.version").value(2))
                .andExpect(jsonPath("$.layout.placements[0].label").value("Sân 1"));
        byte[] result = mvc.perform(get("/api/v1/checkins/court-status").header("Authorization", staff))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertTrue(json.readTree(result).path("layouts").findValuesAsText("groupId").contains(GROUP.toString()));

        save(manager, first).andExpect(status().isConflict());
        save(manager, new Draft(100, 1300, 2, placements)).andExpect(status().isBadRequest());
        var overlapping = new ArrayList<>(placements);
        var second = placements.get(1);
        overlapping.set(1, new CourtPlacement(second.unitId(), second.label(), 100, 0, 750, 1200));
        save(manager, new Draft(first.widthCm(), 1300, 2, overlapping)).andExpect(status().isBadRequest());
        save(manager, new Draft(first.widthCm(), 1300, 2, placements.subList(1, placements.size())))
                .andExpect(status().isBadRequest());
        var duplicateNames = new ArrayList<>(placements);
        duplicateNames.set(1, new CourtPlacement(second.unitId(), " sân 1 ", second.xCm(), second.yCm(), second.widthCm(), second.lengthCm()));
        save(manager, new Draft(first.widthCm(), 1300, 2, duplicateNames)).andExpect(status().isBadRequest());
    }

    private ResultActions save(String authorization, Draft draft) throws Exception {
        return mvc.perform(put(URL).header("Authorization", authorization).contentType("application/json")
                .content(json.writeValueAsBytes(draft)));
    }

    private String bearer(String role, UUID tenantId) {
        Instant now = Instant.now();
        var principal = new SessionPrincipal(UUID.randomUUID(), "court-floor-test",
                List.of(new RoleGrant(role, "TENANT", tenantId)), now, now.plusSeconds(120));
        return "Bearer " + sessions.createSession(principal, Duration.ofMinutes(2));
    }
}
