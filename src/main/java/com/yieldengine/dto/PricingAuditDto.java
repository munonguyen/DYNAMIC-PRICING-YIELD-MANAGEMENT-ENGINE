package com.yieldengine.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PricingAuditDto {
    private BigDecimal basePrice;
    private BigDecimal timeMultiplier;
    private BigDecimal matrixMultiplier;
    private BigDecimal contextMultiplier;
    private BigDecimal rawPrice;
    private BigDecimal clampedPrice;
    private BigDecimal occupancyPercentage;
    private BigDecimal leadHours;
    private Instant calculatedAt;

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("basePrice", basePrice);
        map.put("timeMultiplier", timeMultiplier);
        map.put("matrixMultiplier", matrixMultiplier);
        map.put("contextMultiplier", contextMultiplier);
        map.put("rawPrice", rawPrice);
        map.put("clampedPrice", clampedPrice);
        map.put("occupancyPercentage", occupancyPercentage);
        map.put("leadHours", leadHours);
        map.put("calculatedAt", calculatedAt != null ? calculatedAt.toString() : Instant.now().toString());
        return map;
    }
}
