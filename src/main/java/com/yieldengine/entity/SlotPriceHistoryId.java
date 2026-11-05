package com.yieldengine.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
@Builder
public class SlotPriceHistoryId implements Serializable {

    @Column(nullable = false)
    private Long id;

    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;
}
