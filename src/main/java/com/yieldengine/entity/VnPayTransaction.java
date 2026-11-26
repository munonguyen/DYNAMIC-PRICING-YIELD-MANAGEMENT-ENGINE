package com.yieldengine.entity;

import com.yieldengine.enums.VnPayTransactionStatus;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Type;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Stores VNPAY Payment Gateway v2.1.0 transaction attempts, verified callback metadata,
 * and reconciliation/QueryDR snapshots linked to a booking reservation.
 */
@Entity
@Table(
        name = "vnpay_transactions",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_vnpay_txn_ref", columnNames = {"txn_ref"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VnPayTransaction extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "booking_id", nullable = false)
    private UUID bookingId;

    @Column(name = "reservation_id", nullable = false)
    private UUID reservationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id")
    private Payment payment;

    @Column(name = "txn_ref", nullable = false, length = 100)
    private String txnRef;

    @Column(name = "order_info", nullable = false, length = 255)
    private String orderInfo;

    @Column(name = "order_type", nullable = false, length = 50)
    @Builder.Default
    private String orderType = "other";

    @Column(name = "amount_vnd", nullable = false)
    private Long amountVnd;

    @Column(name = "vnp_amount", nullable = false)
    private Long vnpAmount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(columnDefinition = "bpchar(3)", nullable = false, length = 3)
    @Builder.Default
    private String currency = "VND";

    @Column(nullable = false, length = 5)
    @Builder.Default
    private String locale = "vn";

    @Column(name = "bank_code", length = 30)
    private String bankCode;

    @Column(name = "card_type", length = 30)
    private String cardType;

    @Column(name = "transaction_no", length = 40)
    private String transactionNo;

    @Column(name = "response_code", length = 10)
    private String responseCode;

    @Column(name = "transaction_status", length = 10)
    private String transactionStatus;

    @Column(name = "pay_date", length = 14)
    private String payDate;

    @Column(name = "create_date", nullable = false, length = 14)
    private String createDate;

    @Column(name = "expire_date", nullable = false, length = 14)
    private String expireDate;

    @Column(name = "client_ip", nullable = false, length = 64)
    private String clientIp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    @Builder.Default
    private VnPayTransactionStatus status = VnPayTransactionStatus.PENDING;

    @Column(name = "secure_hash_valid", nullable = false)
    @Builder.Default
    private Boolean secureHashValid = false;

    @Type(JsonType.class)
    @Column(name = "raw_callback_payload", columnDefinition = "jsonb")
    private Map<String, Object> rawCallbackPayload;

    @Column(name = "last_query_dr_at")
    private Instant lastQueryDrAt;

    @Type(JsonType.class)
    @Column(name = "last_query_dr_payload", columnDefinition = "jsonb")
    private Map<String, Object> lastQueryDrPayload;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;
}

