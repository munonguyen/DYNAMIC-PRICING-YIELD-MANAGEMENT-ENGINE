-- =====================================================================================
-- Dynamic Pricing & Yield Management Engine — Sports Venue Marketplace (Version 3.0)
-- Migration V4: Seed 5 Roles, Permissions, Sport Types, QR Signing Key,
--               Cancellation Policy, Platform Commission Rule & Default Accounts
-- =====================================================================================

-- 1. Seed 5 Core Roles (FR-04, BR-RBAC-01)
INSERT INTO roles (code, name, scope) VALUES
    ('ADMIN',      'Platform Administrator', 'PLATFORM'),
    ('ACCOUNTANT', 'Platform Accountant',    'PLATFORM'),
    ('MANAGER',    'Venue Manager',          'TENANT'),
    ('STAFF',      'Venue Staff',            'TENANT'),
    ('USER',       'Player / Customer',      'PLATFORM')
ON CONFLICT (code) DO NOTHING;

-- 2. Seed Fine-Grained Permissions
INSERT INTO permissions (code, description) VALUES
    ('USER_MANAGE',       'Activate, deactivate (soft-delete) and list user accounts'),
    ('ROLE_MANAGE',       'Assign and revoke user roles across platform and tenant scopes'),
    ('SPORT_MANAGE',      'Create, update and retire sport types'),
    ('VENUE_MANAGE',      'Configure venue profile, check-in mode and staff chat toggle'),
    ('STAFF_MANAGE',      'Create, list and deactivate venue staff accounts'),
    ('GROUP_MANAGE',      'Create and update court groups and physical courts'),
    ('GROUP_PUBLISH',     'Publish or unpublish court group listings'),
    ('PRICING_MANAGE',    'Create, activate and rollback yield pricing rule sets'),
    ('POLICY_MANAGE',     'Configure deposit percentage and cancellation policy tiers'),
    ('BOOKING_HOLD',      'Lock price, hold court and pay deposit'),
    ('BOOKING_CANCEL',    'Cancel reservation according to policy or venue authority'),
    ('QR_SCAN',           'Scan QR code or manually check customer in at venue'),
    ('NO_SHOW_MARK',      'Mark confirmed reservation as NO_SHOW after grace period'),
    ('CHAT_PARTICIPATE',  'Send and read messages in venue conversations'),
    ('COMMISSION_MANAGE', 'Configure platform commission rules'),
    ('LEDGER_READ',       'Read financial ledger and run reconciliation'),
    ('SIMULATION_RUN',    'Run Monte Carlo revenue simulation'),
    ('AUDIT_READ',        'Inspect platform and venue audit logs')
ON CONFLICT (code) DO NOTHING;

-- Map Role -> Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE (r.code = 'ADMIN'      AND p.code IN ('USER_MANAGE','ROLE_MANAGE','SPORT_MANAGE','PRICING_MANAGE','BOOKING_CANCEL','COMMISSION_MANAGE','LEDGER_READ','SIMULATION_RUN','AUDIT_READ'))
   OR (r.code = 'ACCOUNTANT' AND p.code IN ('COMMISSION_MANAGE','LEDGER_READ','AUDIT_READ'))
   OR (r.code = 'MANAGER'    AND p.code IN ('VENUE_MANAGE','STAFF_MANAGE','GROUP_MANAGE','GROUP_PUBLISH','PRICING_MANAGE','POLICY_MANAGE','BOOKING_CANCEL','QR_SCAN','NO_SHOW_MARK','CHAT_PARTICIPATE','SIMULATION_RUN','AUDIT_READ'))
   OR (r.code = 'STAFF'      AND p.code IN ('QR_SCAN','NO_SHOW_MARK','CHAT_PARTICIPATE'))
   OR (r.code = 'USER'       AND p.code IN ('BOOKING_HOLD','BOOKING_CANCEL','CHAT_PARTICIPATE'))
ON CONFLICT DO NOTHING;

-- 3. Seed Multi-Sport Catalogue (FR-07, UC-04)
INSERT INTO sport_types (code, name, status) VALUES
    ('PICKLEBALL', 'Pickleball', 'ACTIVE'),
    ('BADMINTON',  'Cầu lông (Badminton)', 'ACTIVE'),
    ('FOOTBALL',   'Bóng đá sân cỏ nhân tạo (Football)', 'ACTIVE'),
    ('TENNIS',     'Quần vợt (Tennis)', 'ACTIVE'),
    ('BASKETBALL', 'Bóng rổ (Basketball)', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

-- 4. Seed QR Check-In Signing Key (Separate purpose from PRICE_LOCK - SRS V.2)
INSERT INTO token_signing_keys (kid, secret_ref, purpose, status, not_before, not_after)
VALUES (
    'QR_KEY_2026_V1',
    'vault://checkin/qr-hmac-secret-v1',
    'QR_CHECKIN',
    'ACTIVE',
    '2026-01-01 00:00:00+00',
    '2030-01-01 00:00:00+00'
) ON CONFLICT (kid) DO NOTHING;

-- 5. Update Default Venue Settings & Seed Cancellation Policy (35% deposit, >=11h 100% refund)
UPDATE tenants
SET address = 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
    latitude = 21.007400,
    longitude = 105.842700,
    checkin_mode = 'QR_STAFF',
    is_staff_chat_enabled = true
WHERE id = '00000000-0000-0000-0000-000000000001';

INSERT INTO cancellation_policies (id, tenant_id, name, status)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Chính sách Hoàn Cọc Tiêu Chuẩn (Trước 11h hoàn 100%)',
    'ACTIVE'
) ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO cancellation_policy_tiers (policy_id, min_hours_before, refund_percent) VALUES
    ('c0000000-0000-0000-0000-000000000001', 11, 100),
    ('c0000000-0000-0000-0000-000000000001', 4,  50)
ON CONFLICT (policy_id, min_hours_before) DO NOTHING;

UPDATE resource_groups
SET publish_status = 'PUBLISHED',
    deposit_percent = 35,
    cancellation_policy_id = 'c0000000-0000-0000-0000-000000000001',
    noshow_grace_minutes = 15
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- 6. Seed Default Platform Commission Rule (10% Commission)
INSERT INTO commission_rules (
    id, tenant_id, sport_type_id, rate_percent, commission_basis, applies_to_forfeit, effective_period, status
) VALUES (
    'd0000000-0000-0000-0000-000000000001',
    NULL,
    NULL,
    10.00,
    'COLLECTED_DEPOSIT',
    true,
    tstzrange('2026-01-01 00:00:00+00', '2030-01-01 00:00:00+00', '[)'),
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

