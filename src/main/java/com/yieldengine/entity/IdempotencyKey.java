package com.yieldengine.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "idempotency_keys")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IdempotencyKey {

    @EmbeddedId
    private IdempotencyKeyId id;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(name = "response_code", nullable = false)
    private Short responseCode;

    @Type(JsonType.class)
    @Column(name = "response_body", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> responseBody;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
