package com.yieldengine.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
@Builder
public class ReservationId implements Serializable {

    @Column(nullable = false)
    private UUID id;

    @Column(name = "slot_start", nullable = false)
    private Instant slotStart;
}
