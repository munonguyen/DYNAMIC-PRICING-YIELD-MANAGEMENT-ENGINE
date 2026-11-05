package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

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
public class ResourceGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 50)
    private String code;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 64)
    @Builder.Default
    private String timezone = "Asia/Ho_Chi_Minh";

    @Column(nullable = false, length = 3)
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

    @Column(nullable = false)
    @Builder.Default
    private String status = "ACTIVE";

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
