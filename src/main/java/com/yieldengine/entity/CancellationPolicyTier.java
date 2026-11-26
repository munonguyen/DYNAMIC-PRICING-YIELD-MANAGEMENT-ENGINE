package com.yieldengine.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "cancellation_policy_tiers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CancellationPolicyTier {

    @EmbeddedId
    private CancellationPolicyTierId id;

    @JsonIgnore
    @MapsId("policyId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "policy_id", nullable = false)
    private CancellationPolicy policy;

    @Column(name = "refund_percent", nullable = false)
    private Short refundPercent;

    public Integer getMinHoursBefore() {
        return id != null ? id.getMinHoursBefore() : null;
    }
}

