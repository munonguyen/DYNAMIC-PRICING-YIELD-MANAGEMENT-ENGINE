package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bookings", uniqueConstraints = {
        @UniqueConstraint(name = "uq_booking_tenant_idem", columnNames = {"tenant_id", "idempotency_key"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(columnDefinition = "bpchar(3)", nullable = false, length = 3)
    @Builder.Default
    private String currency = "VND";

    @Column(name = "total_amount", nullable = false)
    @Builder.Default
    private Long totalAmount = 0L;

    @Column(name = "deposit_total", nullable = false)
    @Builder.Default
    private Long depositTotal = 0L;

    @Column(name = "idempotency_key", length = 100)
    private String idempotencyKey;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "contact_name", length = 150)
    private String contactName;

    @Column(name = "contact_phone", length = 25)
    private String contactPhone;

    @Column(name = "contact_email", columnDefinition = "citext")
    private String contactEmail;

    @Column(name = "need_vat_invoice", nullable = false)
    @Builder.Default
    private Boolean needVatInvoice = false;

    @Column(name = "vat_company_name", length = 200)
    private String vatCompanyName;

    @Column(name = "vat_tax_code", length = 20)
    private String vatTaxCode;

    @Column(name = "booking_note", length = 500)
    private String bookingNote;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;
}
