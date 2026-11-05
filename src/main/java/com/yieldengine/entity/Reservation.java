package com.yieldengine.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "reservations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Reservation {

    @EmbeddedId
    private ReservationId id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "booking_id")
    private UUID bookingId;

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "HELD";

    @Column(name = "locked_price", nullable = false)
    private Long lockedPrice;

    @Type(JsonType.class)
    @Column(name = "pricing_audit", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> pricingAudit = new HashMap<>();

    @Column(name = "token_jti")
    private UUID tokenJti;

    @Column(name = "hold_expires_at")
    private Instant holdExpiresAt;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancel_reason", length = 100)
    private String cancelReason;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getReservationId() {
        return id != null ? id.getId() : null;
    }

    public Instant getSlotStart() {
        return id != null ? id.getSlotStart() : null;
    }
}
