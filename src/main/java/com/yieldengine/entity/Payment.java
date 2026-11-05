package com.yieldengine.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "payments", uniqueConstraints = {
        @UniqueConstraint(name = "uq_payment_provider_ref", columnNames = {"provider", "provider_ref"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Column(nullable = false, length = 30)
    private String provider;

    @Column(name = "provider_ref", nullable = false, length = 100)
    private String providerRef;

    @Column(nullable = false)
    private Long amount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "VND";

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Type(JsonType.class)
    @Column(name = "raw_payload", columnDefinition = "jsonb")
    private Map<String, Object> rawPayload;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
