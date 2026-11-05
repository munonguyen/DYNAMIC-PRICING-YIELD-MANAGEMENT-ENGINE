package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "consumed_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumedToken {

    @Id
    @Column(name = "token_jti")
    private UUID tokenJti;

    @Column(length = 40)
    private String kid;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "reservation_id")
    private UUID reservationId;

    @Column(name = "token_expires", nullable = false)
    private Instant tokenExpires;

    @CreationTimestamp
    @Column(name = "consumed_at", nullable = false, updatable = false)
    private Instant consumedAt;
}
