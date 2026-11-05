package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "yield_rule_sets", uniqueConstraints = {
        @UniqueConstraint(name = "uq_ruleset_group_version", columnNames = {"group_id", "version_no"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class YieldRuleSet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private ResourceGroup resourceGroup;

    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "DRAFT";

    @Column(columnDefinition = "tstzrange", nullable = false)
    private String effective;

    @Column(name = "created_by")
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "ruleSet", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<YieldMatrixRule> matrixRules = new ArrayList<>();

    @OneToMany(mappedBy = "ruleSet", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TimeOfDayFactor> timeOfDayFactors = new ArrayList<>();
}
