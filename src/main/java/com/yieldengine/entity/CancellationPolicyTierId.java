package com.yieldengine.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
@Builder
public class CancellationPolicyTierId implements Serializable {

    @Column(name = "policy_id", nullable = false)
    private UUID policyId;

    @Column(name = "min_hours_before", nullable = false)
    private Integer minHoursBefore;
}

