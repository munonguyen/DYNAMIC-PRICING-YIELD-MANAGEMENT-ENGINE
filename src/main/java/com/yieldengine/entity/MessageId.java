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
public class MessageId implements Serializable {

    @Column(nullable = false)
    private UUID id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}

