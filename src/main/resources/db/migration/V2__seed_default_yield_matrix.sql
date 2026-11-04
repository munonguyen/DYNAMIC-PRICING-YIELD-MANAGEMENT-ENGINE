-- Dynamic Pricing & Yield Management Engine
-- Seed Data: Sample Pickleball Resource Group, 10 Units and 4x4 Yield Matrix Rules

-- 1. Insert Resource Group: Pickleball Main Court Complex
INSERT INTO resource_groups (id, code, name, total_units, base_price, min_price, max_price, created_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'PICKLEBALL_MAIN',
    'Cụm 10 sân Pickleball chuẩn thi đấu',
    10,
    200000.00,
    120000.00,
    350000.00,
    NOW()
) ON CONFLICT (code) DO NOTHING;

-- 2. Insert 10 Physical Units (SAN_01 -> SAN_10)
INSERT INTO units (id, group_id, unit_number, status)
VALUES
    ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'SAN_01', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'SAN_02', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'SAN_03', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'SAN_04', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'SAN_05', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'SAN_06', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000001', 'SAN_07', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000001', 'SAN_08', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000001', 'SAN_09', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001', 'SAN_10', 'ACTIVE')
ON CONFLICT (group_id, unit_number) DO NOTHING;

-- 3. Insert 16 Yield Matrix Rules (4 Occupancy Brackets x 4 Lead Time Brackets)
-- Brackets:
-- Occupancy: [0, 30), [30, 70), [70, 90), [90, 100.01]
-- Lead Hours: [72, 99999), [12, 72), [2, 12), [0, 2)

-- Bracket 1: Thấp (< 30%)
INSERT INTO yield_matrix_rules (id, group_id, rule_name, min_occupancy_pct, max_occupancy_pct, min_lead_hours, max_lead_hours, multiplier, priority, active)
VALUES
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_LOW_LEAD_EARLY', 0.00, 30.00, 72.00, 99999.00, 0.900, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_LOW_LEAD_STD',   0.00, 30.00, 12.00, 72.00,    1.000, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_LOW_LEAD_SOON',  0.00, 30.00, 2.00,  12.00,    0.850, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_LOW_LEAD_LAST',  0.00, 30.00, 0.00,  2.00,     0.700, 1, TRUE);

-- Bracket 2: Trung bình (30% - 70%)
INSERT INTO yield_matrix_rules (id, group_id, rule_name, min_occupancy_pct, max_occupancy_pct, min_lead_hours, max_lead_hours, multiplier, priority, active)
VALUES
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_MED_LEAD_EARLY', 30.00, 70.00, 72.00, 99999.00, 1.000, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_MED_LEAD_STD',   30.00, 70.00, 12.00, 72.00,    1.050, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_MED_LEAD_SOON',  30.00, 70.00, 2.00,  12.00,    1.000, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_MED_LEAD_LAST',  30.00, 70.00, 0.00,  2.00,     0.900, 1, TRUE);

-- Bracket 3: Cao (70% - 90%)
INSERT INTO yield_matrix_rules (id, group_id, rule_name, min_occupancy_pct, max_occupancy_pct, min_lead_hours, max_lead_hours, multiplier, priority, active)
VALUES
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_HIGH_LEAD_EARLY', 70.00, 90.00, 72.00, 99999.00, 1.150, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_HIGH_LEAD_STD',   70.00, 90.00, 12.00, 72.00,    1.200, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_HIGH_LEAD_SOON',  70.00, 90.00, 2.00,  12.00,    1.250, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_HIGH_LEAD_LAST',  70.00, 90.00, 0.00,  2.00,     1.150, 1, TRUE);

-- Bracket 4: Khan hiếm (> 90%)
INSERT INTO yield_matrix_rules (id, group_id, rule_name, min_occupancy_pct, max_occupancy_pct, min_lead_hours, max_lead_hours, multiplier, priority, active)
VALUES
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_SCARCE_LEAD_EARLY', 90.00, 100.01, 72.00, 99999.00, 1.300, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_SCARCE_LEAD_STD',   90.00, 100.01, 12.00, 72.00,    1.400, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_SCARCE_LEAD_SOON',  90.00, 100.01, 2.00,  12.00,    1.500, 1, TRUE),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'OCC_SCARCE_LEAD_LAST',  90.00, 100.01, 0.00,  2.00,     1.450, 1, TRUE);
