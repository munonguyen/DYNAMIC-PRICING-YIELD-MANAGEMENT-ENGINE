package com.yieldengine.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulationRequest {

    private UUID groupId;

    @Builder.Default
    private int totalSimulatedUsers = 1500;

    @Builder.Default
    private int simulationDays = 7;

    @Builder.Default
    private int totalCourts = 10;
}

