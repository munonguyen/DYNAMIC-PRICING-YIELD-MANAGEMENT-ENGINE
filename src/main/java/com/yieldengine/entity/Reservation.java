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

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "booking_id")
    private UUID bookingId;

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "HELD";

    @Column(name = "locked_price", nullable = false)
    private Long lockedPrice;

    @Column(name = "deposit_amount", nullable = false)
    @Builder.Default
    private Long depositAmount = 0L;

    @Column(name = "refund_amount", nullable = false)
    @Builder.Default
    private Long refundAmount = 0L;

    @Column(name = "forfeited_amount", nullable = false)
    @Builder.Default
    private Long forfeitedAmount = 0L;

    @Type(JsonType.class)
    @Column(name = "pricing_audit", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> pricingAudit = new HashMap<>();

    @Type(JsonType.class)
    @Column(name = "policy_snapshot", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> policySnapshot = new HashMap<>();

    @Column(name = "token_jti")
    private UUID tokenJti;

    @Column(name = "qr_jti")
    private UUID qrJti;

    @Column(name = "checkin_pin_hash")
    private String checkinPinHash;

    @Column(name = "checkin_pin_hint", length = 16)
    private String checkinPinHint;

    @Column(name = "pin_failed_attempts", nullable = false)
    @Builder.Default
    private Integer pinFailedAttempts = 0;

    @Column(name = "pin_locked_until")
    private Instant pinLockedUntil;

    @Column(name = "pin_consumed_at")
    private Instant pinConsumedAt;

    @Column(name = "hold_expires_at")
    private Instant holdExpiresAt;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "checked_in_at")
    private Instant checkedInAt;

    @Column(name = "no_show_marked_at")
    private Instant noShowMarkedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancelled_by")
    private UUID cancelledBy;

    @Column(name = "cancelled_by_role")
    private String cancelledByRole;

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
