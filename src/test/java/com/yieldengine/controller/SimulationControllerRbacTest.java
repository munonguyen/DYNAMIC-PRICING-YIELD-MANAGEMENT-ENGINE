package com.yieldengine.controller;

import com.yieldengine.dto.request.SimulationRequest;
import com.yieldengine.dto.response.SimulationResultResponse;
import com.yieldengine.exception.ForbiddenAccessException;
import com.yieldengine.exception.UnauthorizedException;
import com.yieldengine.security.AuthContext;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.security.SessionPrincipal;
import com.yieldengine.service.SimulationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("SimulationController RBAC Authorization Tests (Lessor & Admin only)")
class SimulationControllerRbacTest {

    @AfterEach
    void tearDown() {
        AuthContext.clear();
    }

    @Test
    @DisplayName("Blocks unauthenticated guests and regular USER accounts; allows MANAGER (Lessor) and ADMIN")
    void enforcesLessorAndAdminOnlyAccess() {
        SimulationService mockSim = mock(SimulationService.class);
        when(mockSim.runMonteCarloSimulation(any())).thenReturn(SimulationResultResponse.builder()
                .totalSimulatedUsers(1500)
                .revParUpliftPct(java.math.BigDecimal.valueOf(24.5))
                .build());

        SimulationController controller = new SimulationController(mockSim, new RbacGuard());

        // 1. Unauthenticated guest -> UnauthorizedException
        assertThrows(UnauthorizedException.class, () -> controller.runSimulation(new SimulationRequest()));

        // 2. Regular USER -> ForbiddenAccessException
        AuthContext.set(principalWith("USER", "PLATFORM", null), "tok_user");
        assertThrows(ForbiddenAccessException.class, () -> controller.runSimulation(new SimulationRequest()));

        // 3. Venue MANAGER (Lessor) -> Allowed
        AuthContext.set(principalWith("MANAGER", "TENANT", UUID.randomUUID()), "tok_mgr");
        assertEquals(java.math.BigDecimal.valueOf(24.5), controller.runSimulation(new SimulationRequest()).getBody().getRevParUpliftPct());

        // 4. Platform ADMIN -> Allowed
        AuthContext.set(principalWith("ADMIN", "PLATFORM", null), "tok_adm");
        assertNotNull(controller.runSimulation(new SimulationRequest()).getBody());

        verify(mockSim, times(2)).runMonteCarloSimulation(any());
    }

    private SessionPrincipal principalWith(String role, String scope, UUID tenantId) {
        return new SessionPrincipal(
                UUID.randomUUID(),
                role.toLowerCase(),
                List.of(new SessionPrincipal.RoleGrant(role, scope, tenantId)),
                Instant.now(),
                Instant.now().plusSeconds(3600)
        );
    }
}
