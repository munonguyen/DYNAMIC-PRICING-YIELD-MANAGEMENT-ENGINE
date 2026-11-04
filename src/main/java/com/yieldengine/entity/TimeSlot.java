package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "time_slots", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"group_id", "slot_start", "slot_end"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TimeSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private ResourceGroup resourceGroup;

    @Column(name = "slot_start", nullable = false)
    private Instant slotStart;

    @Column(name = "slot_end", nullable = false)
    private Instant slotEnd;

    @Column(name = "total_capacity", nullable = false)
    private Integer totalCapacity;

    @Column(name = "reserved_count", nullable = false)
    @Builder.Default
    private Integer reservedCount = 0;

    @Column(name = "context_multiplier", nullable = false, precision = 5, scale = 3)
    @Builder.Default
    private BigDecimal contextMultiplier = BigDecimal.valueOf(1.000);

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;

    @OneToOne(mappedBy = "timeSlot", cascade = CascadeType.ALL, orphanRemoval = true)
    private SlotPriceSnapshot slotPriceSnapshot;

    public double getOccupancyPercentage() {
        if (totalCapacity == null || totalCapacity == 0) {
            return 0.0;
        }
        return (double) (reservedCount != null ? reservedCount : 0) / totalCapacity * 100.0;
    }
}
