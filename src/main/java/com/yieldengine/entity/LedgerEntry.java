package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ledger_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LedgerEntry {

    @EmbeddedId
    private LedgerEntryId id;

    @Column(name = "journal_id", nullable = false)
    private UUID journalId;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "reservation_id")
    private UUID reservationId;

    @Column(name = "payment_id")
    private UUID paymentId;

    @Column(name = "account_code", nullable = false)
    private String accountCode;

    @Column(name = "entry_type", nullable = false)
    private String entryType;

    @Column(nullable = false)
    private String direction;

    @Column(nullable = false)
    private Long amount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(columnDefinition = "bpchar(3)", nullable = false, length = 3)
    @Builder.Default
    private String currency = "VND";

    public UUID getEntryId() {
        return id != null ? id.getId() : null;
    }

    public Instant getOccurredAt() {
        return id != null ? id.getOccurredAt() : null;
    }
}

