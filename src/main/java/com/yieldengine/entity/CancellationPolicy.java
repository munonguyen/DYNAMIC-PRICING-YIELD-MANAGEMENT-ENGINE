package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "cancellation_policies", uniqueConstraints = {
        @UniqueConstraint(name = "uq_policy_tenant_name", columnNames = {"tenant_id", "name"}),
        @UniqueConstraint(name = "uq_policy_tenant_id", columnNames = {"tenant_id", "id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CancellationPolicy extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    @Builder.Default
    private String status = "ACTIVE";

    @OneToMany(mappedBy = "policy", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("id.minHoursBefore DESC")
    @Builder.Default
    private List<CancellationPolicyTier> tiers = new ArrayList<>();
}

