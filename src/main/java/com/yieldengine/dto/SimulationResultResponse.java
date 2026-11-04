package com.yieldengine.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulationResultResponse {

    private int totalSimulatedUsers;
    private int simulationDays;
    private int totalCourts;
    private int totalSlotHours;

    private ModelMetrics fixedPricing;
    private ModelMetrics dynamicPricing;

    private BigDecimal revenueUpliftPct;
    private BigDecimal revParUpliftPct;
    private String summaryMessage;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModelMetrics {
        private String modelName;
        private int totalBookings;
        private double occupancyRate;
        private BigDecimal totalRevenue;
        private BigDecimal revPar; // Revenue Per Available Resource (Revenue / Total Slot Hours)
    }
}
