package com.yieldengine.controller;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.dto.request.SimulationRequest;
import com.yieldengine.dto.response.SimulationResultResponse;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.SimulationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "4. Simulation Sandbox (Lessor & Admin)", description = "Internal Monte Carlo simulation strictly restricted to Venue Managers (Lessors) and Platform Admins")
@RestController
@RequestMapping("/api/v1/simulations")
@RequiredArgsConstructor
public class SimulationController {

    private final SimulationService simulationService;
    private final RbacGuard rbacGuard;

    @Operation(
            summary = "Run Monte Carlo Revenue Simulation (MANAGER / ADMIN only)",
            description = "Simulates 1,500 customer bookings over 7 days across 10 courts. Restricted to verified Lessors (MANAGER) and Platform ADMIN."
    )
    @PostMapping("/run")
    public ResponseEntity<SimulationResultResponse> runSimulation(@RequestBody(required = false) SimulationRequest request) {
        rbacGuard.requireAnyRole(SystemConstant.ROLE_MANAGER, SystemConstant.ROLE_ADMIN);
        if (request == null) {
            request = new SimulationRequest();
        }
        SimulationResultResponse result = simulationService.runMonteCarloSimulation(request);
        return ResponseEntity.ok(result);
    }
}
