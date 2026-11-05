package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "time_of_day_factors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TimeOfDayFactor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rule_set_id", nullable = false)
    private YieldRuleSet ruleSet;

    @Column(name = "day_of_week", nullable = false)
    private Short dayOfWeek;

    @Column(name = "from_hour", nullable = false)
    private Short fromHour;

    @Column(name = "to_hour", nullable = false)
    private Short toHour;

    @Column(nullable = false, precision = 6, scale = 4)
    private BigDecimal multiplier;
}
