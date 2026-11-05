package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "time_slots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TimeSlot {

    @EmbeddedId
    private SlotId id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "slot_end", nullable = false)
    private Instant slotEnd;

    @Column(name = "total_capacity", nullable = false)
    private Integer totalCapacity;

    @Column(name = "context_multiplier", nullable = false, precision = 6, scale = 4)
    @Builder.Default
    private BigDecimal contextMultiplier = BigDecimal.valueOf(1.0000);

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "OPEN";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public UUID getGroupId() {
        return id != null ? id.getGroupId() : null;
    }

    public Instant getSlotStart() {
        return id != null ? id.getSlotStart() : null;
    }
}
