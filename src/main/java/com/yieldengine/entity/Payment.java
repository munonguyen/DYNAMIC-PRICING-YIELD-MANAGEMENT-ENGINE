package com.yieldengine.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Type;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "payments", uniqueConstraints = {
        @UniqueConstraint(name = "uq_payment_provider_ref", columnNames = {"provider", "provider_ref"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Column(nullable = false, length = 30)
    private String provider;

    @Column(name = "provider_ref", nullable = false, length = 100)
    private String providerRef;

    @Column(name = "payment_type", nullable = false)
    @Builder.Default
    private String paymentType = "DEPOSIT";

    @Column(name = "related_payment_id")
    private UUID relatedPaymentId;

    @Column(nullable = false)
    private Long amount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(columnDefinition = "bpchar(3)", nullable = false, length = 3)
    @Builder.Default
    private String currency = "VND";

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "gateway_verified_at")
    private Instant gatewayVerifiedAt;

    @Column(name = "checkout_qr_payload", length = 1024)
    private String checkoutQrPayload;

    @Column(name = "checkout_qr_sandbox")
    private Boolean checkoutQrSandbox;

    @Type(JsonType.class)
    @Column(name = "raw_payload", columnDefinition = "jsonb")
    private Map<String, Object> rawPayload;
}
