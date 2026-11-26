package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "commission_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommissionRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "sport_type_id")
    private Short sportTypeId;

    @Column(name = "rate_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal ratePercent;

    @Column(name = "commission_basis", nullable = false)
    @Builder.Default
    private String commissionBasis = "COLLECTED_DEPOSIT";

    @Column(name = "applies_to_forfeit", nullable = false)
    @Builder.Default
    private Boolean appliesToForfeit = true;

    @org.hibernate.annotations.ColumnTransformer(write = "?::tstzrange")
    @Column(name = "effective_period", columnDefinition = "tstzrange", nullable = false)
    private String effectivePeriod;

    @Column(nullable = false)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "created_by")
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
