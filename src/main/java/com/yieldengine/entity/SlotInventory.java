package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "slot_inventory")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SlotInventory {

    @EmbeddedId
    private SlotId id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "held_count", nullable = false)
    @Builder.Default
    private Integer heldCount = 0;

    @Column(name = "confirmed_count", nullable = false)
    @Builder.Default
    private Integer confirmedCount = 0;

    @Column(name = "total_capacity", nullable = false)
    private Integer totalCapacity;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public double getOccupancyPercentage() {
        if (totalCapacity == null || totalCapacity == 0) {
            return 0.0;
        }
        int occupied = (heldCount != null ? heldCount : 0) + (confirmedCount != null ? confirmedCount : 0);
        return (double) occupied / totalCapacity * 100.0;
    }
}
