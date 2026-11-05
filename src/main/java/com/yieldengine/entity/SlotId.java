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
public class SlotId implements Serializable {

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @Column(name = "slot_start", nullable = false)
    private Instant slotStart;
}
