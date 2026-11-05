package com.yieldengine.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "slot_price_current")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SlotPriceCurrent {

    @EmbeddedId
    private SlotId id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "current_price", nullable = false)
    private Long currentPrice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rule_set_id", nullable = false)
    private YieldRuleSet ruleSet;

    @Type(JsonType.class)
    @Column(name = "applied_factors", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> appliedFactors = new HashMap<>();

    @Column(name = "price_seq", nullable = false)
    @Builder.Default
    private Long priceSeq = 1L;

    @Column(name = "computed_at", nullable = false)
    @Builder.Default
    private Instant computedAt = Instant.now();
}
