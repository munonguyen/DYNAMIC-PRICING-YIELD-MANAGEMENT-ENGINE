package com.yieldengine.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(
        name = "resource_group_media",
        indexes = {
                @Index(name = "idx_group_media_lookup", columnList = "resource_group_id, is_cover, display_order, created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResourceGroupMedia extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "resource_group_id", nullable = false)
    private UUID resourceGroupId;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "file_size_bytes", nullable = false)
    private long fileSizeBytes;

    @Column(name = "storage_source", nullable = false)
    @Builder.Default
    private String storageSource = "LOCAL_DISK";

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "caption", length = 255)
    private String caption;

    @Column(name = "is_cover", nullable = false)
    @Builder.Default
    private boolean cover = false;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private int displayOrder = 0;

    @Column(name = "uploaded_by")
    private UUID uploadedBy;
}
