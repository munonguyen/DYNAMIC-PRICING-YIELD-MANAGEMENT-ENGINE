package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "token_signing_keys")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TokenSigningKey {

    @Id
    @Column(length = 40)
    private String kid;

    @Column(name = "secret_ref", nullable = false, length = 200)
    private String secretRef;

    @Column(nullable = false)
    @Builder.Default
    private String status = "ACTIVE";

    @CreationTimestamp
    @Column(name = "not_before", nullable = false)
    private Instant notBefore;

    @Column(name = "not_after", nullable = false)
    private Instant notAfter;
}
