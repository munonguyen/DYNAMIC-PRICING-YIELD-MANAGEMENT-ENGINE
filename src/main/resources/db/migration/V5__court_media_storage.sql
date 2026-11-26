-- =====================================================================================
-- Dynamic Pricing & Yield Management Engine — Sports Venue Marketplace
-- Migration V5: Real Court Photo Storage & Lessor Gallery Management
-- =====================================================================================

CREATE TABLE IF NOT EXISTS resource_group_media (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    resource_group_id   UUID NOT NULL,
    file_name           VARCHAR(255) NOT NULL,
    content_type        VARCHAR(100) NOT NULL,
    file_size_bytes     BIGINT NOT NULL CHECK (file_size_bytes >= 0),
    storage_source      TEXT NOT NULL DEFAULT 'LOCAL_DISK'
                            CHECK (storage_source IN ('LOCAL_DISK', 'STATIC_ASSET')),
    storage_key         VARCHAR(500) NOT NULL,
    caption             VARCHAR(255),
    is_cover            BOOLEAN NOT NULL DEFAULT false,
    display_order       INT NOT NULL DEFAULT 0,
    uploaded_by         UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_media_group_tenant
        FOREIGN KEY (tenant_id, resource_group_id)
        REFERENCES resource_groups(tenant_id, id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_group_media_lookup
    ON resource_group_media (resource_group_id, is_cover DESC, display_order ASC, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_media_single_cover
    ON resource_group_media (resource_group_id)
    WHERE is_cover = true;

-- Seed authentic owner-taken gallery photos for default resource group if present
INSERT INTO resource_group_media (
    id, tenant_id, resource_group_id, file_name, content_type,
    file_size_bytes, storage_source, storage_key, caption, is_cover, display_order
)
SELECT
    v.id::uuid,
    rg.tenant_id,
    rg.id,
    v.file_name,
    'image/jpeg',
    v.file_size_bytes,
    'STATIC_ASSET',
    v.storage_key,
    v.caption,
    v.is_cover,
    v.display_order
FROM resource_groups rg
CROSS JOIN (
    VALUES
        ('e1000000-0000-0000-0000-000000000001', 'real-pickleball-outdoor.jpg', 303104, '/images/real-pickleball-outdoor.jpg', 'Ảnh chủ sân chụp trực tiếp • Cụm sân ngoài trời & lưới chuẩn USAPA', true, 0),
        ('e1000000-0000-0000-0000-000000000002', 'real-pickleball-net.jpg',     202752, '/images/real-pickleball-net.jpg',     'Ảnh thực tế tại sân • Mặt thảm interlock chống trượt & vạch kẻ rõ nét', false, 1),
        ('e1000000-0000-0000-0000-000000000003', 'real-pickleball-indoor.jpg',  494592, '/images/real-pickleball-indoor.jpg',  'Ảnh thực tế khu mái che • Giếng trời thoáng sáng tự nhiên', false, 2)
) AS v(id, file_name, file_size_bytes, storage_key, caption, is_cover, display_order)
WHERE rg.id = 'a0000000-0000-0000-0000-000000000001'::uuid
ON CONFLICT (id) DO NOTHING;
