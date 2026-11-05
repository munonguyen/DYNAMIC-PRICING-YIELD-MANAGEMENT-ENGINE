-- Dynamic Pricing & Yield Management Engine
-- Seed Data: Schema V2 (Tenants, Signing Keys, Resource Group, 10 Units, Active Rule Set, 4x4 Matrix)

-- 1. Insert Tenant
INSERT INTO tenants (id, code, name, status, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'DEFAULT_TENANT',
    'Hệ Thống Quản Lý Sân Thể Thao Tiêu Chuẩn',
    'ACTIVE',
    NOW()
) ON CONFLICT (code) DO NOTHING;

-- 2. Insert Token Signing Key
INSERT INTO token_signing_keys (kid, secret_ref, status, not_before, not_after)
VALUES (
    'KEY_2026_V1',
    'vault://pricing/hmac-secret-v1',
    'ACTIVE',
    '2026-01-01 00:00:00+00',
    '2030-01-01 00:00:00+00'
) ON CONFLICT (kid) DO NOTHING;

-- 3. Insert Resource Group: Pickleball Main Court Complex
INSERT INTO resource_groups (
    id, tenant_id, code, name, timezone, currency, slot_minutes, hold_ttl_seconds,
    base_price, min_price, max_price, status, version, created_at
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'PICKLEBALL_MAIN',
    'Cụm 10 sân Pickleball chuẩn thi đấu',
    'Asia/Ho_Chi_Minh',
    'VND',
    60,
    600,
    200000, -- 200,000 VND / hour
    120000, -- 120,000 VND / hour
    350000, -- 350,000 VND / hour
    'ACTIVE',
    0,
    NOW()
) ON CONFLICT (tenant_id, code) DO NOTHING;

-- 4. Insert 10 Physical Units (SAN_01 -> SAN_10)
INSERT INTO units (id, tenant_id, group_id, unit_number, status, version, created_at)
SELECT 
    ('a0000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'SAN_' || lpad(i::text, 2, '0'),
    'ACTIVE',
    0,
    NOW()
FROM generate_series(1, 10) i
ON CONFLICT (group_id, unit_number) DO NOTHING;

-- 5. Insert Active Yield Rule Set (Version 1)
INSERT INTO yield_rule_sets (
    id, tenant_id, group_id, version_no, status, effective, created_at
) VALUES (
    'b0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    1,
    'ACTIVE',
    tstzrange('2026-01-01 00:00:00+00', '2030-01-01 00:00:00+00', '[)'),
    NOW()
) ON CONFLICT (group_id, version_no) DO NOTHING;

-- 6. Insert 16 Yield Matrix Rules (4 Occupancy Brackets x 4 Lead Time Brackets)
-- Occupancy brackets: [0, 30), [30, 70), [70, 90), [90, 100.01]
-- Lead Hours: [72, 99999), [12, 72), [2, 12), [0, 2)
INSERT INTO yield_matrix_rules (id, rule_set_id, rule_name, occupancy_pct, lead_hours, multiplier)
VALUES
    -- Bracket 1: Thấp (< 30%)
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_LOW_LEAD_EARLY',   numrange(0, 30, '[)'),      numrange(72, 99999, '[]'), 0.9000),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_LOW_LEAD_STD',     numrange(0, 30, '[)'),      numrange(12, 72, '[)'),    1.0000),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_LOW_LEAD_SOON',    numrange(0, 30, '[)'),      numrange(2, 12, '[)'),     0.8500),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_LOW_LEAD_LAST',    numrange(0, 30, '[)'),      numrange(0, 2, '[)'),      0.7000),

    -- Bracket 2: Trung bình (30% - 70%)
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_MED_LEAD_EARLY',   numrange(30, 70, '[)'),     numrange(72, 99999, '[]'), 1.0000),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_MED_LEAD_STD',     numrange(30, 70, '[)'),     numrange(12, 72, '[)'),    1.0500),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_MED_LEAD_SOON',    numrange(30, 70, '[)'),     numrange(2, 12, '[)'),     1.0000),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_MED_LEAD_LAST',    numrange(30, 70, '[)'),     numrange(0, 2, '[)'),      0.9000),

    -- Bracket 3: Cao (70% - 90%)
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_HIGH_LEAD_EARLY',  numrange(70, 90, '[)'),     numrange(72, 99999, '[]'), 1.1500),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_HIGH_LEAD_STD',    numrange(70, 90, '[)'),     numrange(12, 72, '[)'),    1.2000),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_HIGH_LEAD_SOON',   numrange(70, 90, '[)'),     numrange(2, 12, '[)'),     1.2500),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_HIGH_LEAD_LAST',   numrange(70, 90, '[)'),     numrange(0, 2, '[)'),      1.1500),

    -- Bracket 4: Khan hiếm (> 90%)
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_SCARCE_LEAD_EARLY',numrange(90, 100.01, '[]'), numrange(72, 99999, '[]'), 1.3000),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_SCARCE_LEAD_STD',  numrange(90, 100.01, '[]'), numrange(12, 72, '[)'),    1.4000),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_SCARCE_LEAD_SOON', numrange(90, 100.01, '[]'), numrange(2, 12, '[)'),     1.5000),
    (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'OCC_SCARCE_LEAD_LAST', numrange(90, 100.01, '[]'), numrange(0, 2, '[)'),      1.4500);

-- 7. Insert Time of Day Factors (Peak 17h-21h)
INSERT INTO time_of_day_factors (id, rule_set_id, day_of_week, from_hour, to_hour, multiplier)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', dow, 17, 21, 1.2000
FROM generate_series(1, 7) dow;

-- 8. Insert Context Factors (Sample Weather / Promotion multiplier)
INSERT INTO context_factors (id, tenant_id, group_id, kind, period, multiplier, source, created_at)
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'WEATHER',
    tstzrange('2026-01-01 00:00:00+00', '2030-01-01 00:00:00+00', '[)'),
    1.0000,
    'DEFAULT_NORMAL_WEATHER',
    NOW()
);
