package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "unit_time_locks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UnitTimeLock {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Column(columnDefinition = "tstzrange", nullable = false)
    private String period;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String kind = "HOLD";

    @Column(name = "reservation_id", unique = true)
    private UUID reservationId;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
