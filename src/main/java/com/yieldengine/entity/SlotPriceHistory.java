package com.yieldengine.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "slot_price_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SlotPriceHistory {

    @EmbeddedId
    private SlotPriceHistoryId id;

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @Column(name = "slot_start", nullable = false)
    private Instant slotStart;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private Long price;

    @Column(name = "rule_set_id")
    private UUID ruleSetId;

    @Type(JsonType.class)
    @Column(name = "applied_factors", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> appliedFactors = new HashMap<>();

    @Column(name = "trigger_event", nullable = false)
    private String triggerEvent;
}
