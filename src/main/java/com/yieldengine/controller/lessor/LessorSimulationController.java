package com.yieldengine.controller.lessor;

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

@Tag(name = "[ROLE: MANAGER / ADMIN] Yield Simulation Sandbox", description = "Internal Monte Carlo revenue simulation restricted to Lessors and Admins")
@RestController
@RequestMapping("/api/v1/simulations")
@RequiredArgsConstructor
public class LessorSimulationController {

    private final SimulationService simulationService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[MANAGER / ADMIN] Run Monte Carlo Revenue Simulation")
    @PostMapping("/run")
    public ResponseEntity<SimulationResultResponse> runSimulation(
            @RequestBody(required = false) SimulationRequest request
    ) {
        rbacGuard.requireAnyRole(SystemConstant.ROLE_MANAGER, SystemConstant.ROLE_ADMIN);
        if (request == null) {
            request = new SimulationRequest();
        }
        return ResponseEntity.ok(simulationService.runMonteCarloSimulation(request));
    }
}

