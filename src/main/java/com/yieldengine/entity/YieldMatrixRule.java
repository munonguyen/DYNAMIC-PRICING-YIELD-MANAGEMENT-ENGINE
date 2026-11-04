package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "yield_matrix_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class YieldMatrixRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private ResourceGroup resourceGroup;

    @Column(name = "rule_name", nullable = false, length = 100)
    private String ruleName;

    @Column(name = "min_occupancy_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal minOccupancyPct;

    @Column(name = "max_occupancy_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxOccupancyPct;

    @Column(name = "min_lead_hours", nullable = false, precision = 7, scale = 2)
    private BigDecimal minLeadHours;

    @Column(name = "max_lead_hours", nullable = false, precision = 7, scale = 2)
    private BigDecimal maxLeadHours;

    @Column(nullable = false, precision = 5, scale = 3)
    private BigDecimal multiplier;

    @Column(nullable = false)
    @Builder.Default
    private Integer priority = 1;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    /**
     * Checks if given occupancy percentage and lead hours fall within this rule's bracket [min, max)
     */
    public boolean matches(BigDecimal occupancyPct, BigDecimal leadHours) {
        if (!Boolean.TRUE.equals(active)) {
            return false;
        }
        boolean occMatches = occupancyPct.compareTo(minOccupancyPct) >= 0 && occupancyPct.compareTo(maxOccupancyPct) < 0;
        boolean leadMatches = leadHours.compareTo(minLeadHours) >= 0 && leadHours.compareTo(maxLeadHours) < 0;
        return occMatches && leadMatches;
    }
}
