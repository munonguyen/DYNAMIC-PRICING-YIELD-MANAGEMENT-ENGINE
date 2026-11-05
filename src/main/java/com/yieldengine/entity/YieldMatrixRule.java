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
    @JoinColumn(name = "rule_set_id", nullable = false)
    private YieldRuleSet ruleSet;

    @Column(name = "rule_name", nullable = false, length = 100)
    private String ruleName;

    @Column(name = "occupancy_pct", columnDefinition = "numrange", nullable = false)
    private String occupancyPct;

    @Column(name = "lead_hours", columnDefinition = "numrange", nullable = false)
    private String leadHours;

    @Column(nullable = false, precision = 6, scale = 4)
    private BigDecimal multiplier;
}
