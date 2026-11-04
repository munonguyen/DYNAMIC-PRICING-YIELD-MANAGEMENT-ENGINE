package com.yieldengine.controller;

import com.yieldengine.dto.SimulationRequest;
import com.yieldengine.dto.SimulationResultResponse;
import com.yieldengine.service.SimulationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "4. Simulation Sandbox", description = "Monte Carlo simulation comparing traditional fixed pricing vs dynamic yield management")
@RestController
@RequestMapping("/api/v1/simulations")
@RequiredArgsConstructor
public class SimulationController {

    private final SimulationService simulationService;

    @Operation(
            summary = "Run Monte Carlo Revenue Simulation",
            description = "Simulates 1,500 customer bookings over 7 days across 10 courts (980 slot hours). Compares Fixed Pricing vs Multi-Factor Dynamic Yield Pricing."
    )
    @PostMapping("/run")
    public ResponseEntity<SimulationResultResponse> runSimulation(@RequestBody(required = false) SimulationRequest request) {
        if (request == null) {
            request = new SimulationRequest();
        }
        SimulationResultResponse result = simulationService.runMonteCarloSimulation(request);
        return ResponseEntity.ok(result);
    }
}
