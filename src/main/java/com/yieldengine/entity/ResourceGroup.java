package com.yieldengine.entity;

import jakarta.persistence.*;
import com.yieldengine.record.marketplace.CourtAddOn;
import java.util.List;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "resource_groups", uniqueConstraints = {
        @UniqueConstraint(name = "uq_group_tenant_code", columnNames = {"tenant_id", "code"}),
        @UniqueConstraint(name = "uq_group_tenant_id", columnNames = {"tenant_id", "id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResourceGroup extends BaseEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "sport_type_id", nullable = false)
    private SportType sportType;

    @Column(nullable = false, length = 50)
    private String code;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 64)
    @Builder.Default
    private String timezone = "Asia/Ho_Chi_Minh";

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(columnDefinition = "bpchar(3)", nullable = false, length = 3)
    @Builder.Default
    private String currency = "VND";

    @Column(name = "slot_minutes", nullable = false)
    @Builder.Default
    private Integer slotMinutes = 60;

    @Column(name = "hold_ttl_seconds", nullable = false)
    @Builder.Default
    private Integer holdTtlSeconds = 600;

    @Column(name = "base_price", nullable = false)
    private Long basePrice;

    @Column(name = "min_price", nullable = false)
    private Long minPrice;

    @Column(name = "max_price", nullable = false)
    private Long maxPrice;

    @Column(name = "publish_status", nullable = false)
    @Builder.Default
    private String publishStatus = "DRAFT";

    @Column(name = "deposit_percent", nullable = false)
    @Builder.Default
    private Short depositPercent = 0;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cancellation_policy_id")
    private CancellationPolicy cancellationPolicy;

    @Column(name = "noshow_grace_minutes", nullable = false)
    @Builder.Default
    private Integer noshowGraceMinutes = 15;

    @Column(name = "balance_payment_mode", nullable = false)
    @Builder.Default
    private String balancePaymentMode = "AT_VENUE";

    @Column(name = "checkin_mode", nullable = false)
    @Builder.Default
    private String checkinMode = "QR_STAFF";

    @Column(nullable = false)
    @Builder.Default
    private String status = "ACTIVE";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "add_on_services", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private List<CourtAddOn> addOnServices = List.of();

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /**
     * Resolves the effective venue check-in mode for this court group, inheriting from tenant when unset.
     */
    public String resolveEffectiveCheckinMode() {
        if (checkinMode != null && !checkinMode.isBlank()) {
            return checkinMode;
        }
        return tenant != null && tenant.getCheckinMode() != null
                ? tenant.getCheckinMode()
                : "QR_STAFF";
    }
}
