-- =====================================================================================
-- Dynamic Pricing & Yield Management Engine — Real Multi-Venue Operations & Ledger Seed
-- Migration V10: Seed realistic courts, upcoming slots, bookings, reservations,
--                multi-gateway payments, and double-entry balanced ledger journals
--                across the trailing 7 days for real DB & Elasticsearch analytics.
-- =====================================================================================

-- 1. Seed additional realistic Tenants (Partner Lessors across HN, HCM, DN)
INSERT INTO tenants (id, code, name, address, latitude, longitude, checkin_mode, is_staff_chat_enabled, status, created_at)
VALUES
    ('00000000-0000-0000-0000-000000000002', 'MYDINH_ARENA',   'Tập đoàn Vận hành Mỹ Đình Arena JSC',  'Khu liên hợp Thể thao Mỹ Đình, Nam Từ Liêm, Hà Nội', 21.020500, 105.763900, 'QR_STAFF', true, 'ACTIVE', NOW() - INTERVAL '120 days'),
    ('00000000-0000-0000-0000-000000000003', 'WESTLAKE_CLUB',  'Westlake Prestige Sports Club',       'Đặng Thai Mai, Quảng An, Tây Hồ, Hà Nội',            21.064100, 105.823500, 'QR_STAFF', true, 'ACTIVE', NOW() - INTERVAL '90 days'),
    ('00000000-0000-0000-0000-000000000004', 'SAIGON_SOUTH',   'Saigon South Athletic Group',         'Nguyễn Văn Linh, Tân Phong, Quận 7, TP.HCM',         10.729500, 106.718500, 'QR_STAFF', true, 'ACTIVE', NOW() - INTERVAL '75 days')
ON CONFLICT (code) DO NOTHING;

-- Cancellation policy for partner tenants
INSERT INTO cancellation_policies (id, tenant_id, name, status)
VALUES
    ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Chính sách Chuẩn Mỹ Đình (11h hoàn 100%)', 'ACTIVE'),
    ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Chính sách Chuẩn Westlake (11h hoàn 100%)', 'ACTIVE'),
    ('c0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Chính sách Chuẩn Quận 7 (11h hoàn 100%)', 'ACTIVE')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 2. Seed additional published Resource Groups across Sports
INSERT INTO resource_groups (
    id, tenant_id, code, name, timezone, currency, slot_minutes, hold_ttl_seconds,
    base_price, min_price, max_price, status, version, created_at,
    sport_type_id, publish_status, deposit_percent, cancellation_policy_id, noshow_grace_minutes
)
SELECT
    'a0000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    'FOOTBALL_7V7_PRO',
    'Cụm 6 Sân Bóng đá 7v7 FIFA Quality Pro & Đèn Chống Lóa',
    'Asia/Ho_Chi_Minh', 'VND', 90, 600,
    780000, 520000, 1180000, 'ACTIVE', 0, NOW() - INTERVAL '60 days',
    st.id, 'PUBLISHED', 35, 'c0000000-0000-0000-0000-000000000002'::uuid, 15
FROM sport_types st WHERE st.code = 'FOOTBALL'
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO resource_groups (
    id, tenant_id, code, name, timezone, currency, slot_minutes, hold_ttl_seconds,
    base_price, min_price, max_price, status, version, created_at,
    sport_type_id, publish_status, deposit_percent, cancellation_policy_id, noshow_grace_minutes
)
SELECT
    'a0000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'BADMINTON_BWF',
    'Nhà Thi Đấu 8 Sân Cầu Lông Thảm Yonex Chuẩn BWF',
    'Asia/Ho_Chi_Minh', 'VND', 60, 600,
    140000, 95000, 220000, 'ACTIVE', 0, NOW() - INTERVAL '60 days',
    st.id, 'PUBLISHED', 30, 'c0000000-0000-0000-0000-000000000001'::uuid, 15
FROM sport_types st WHERE st.code = 'BADMINTON'
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO resource_groups (
    id, tenant_id, code, name, timezone, currency, slot_minutes, hold_ttl_seconds,
    base_price, min_price, max_price, status, version, created_at,
    sport_type_id, publish_status, deposit_percent, cancellation_policy_id, noshow_grace_minutes
)
SELECT
    'a0000000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    'TENNIS_WESTLAKE',
    'Cụm 4 Sân Tennis Acrylic US Open Ven Hồ Tây',
    'Asia/Ho_Chi_Minh', 'VND', 60, 600,
    310000, 210000, 460000, 'ACTIVE', 0, NOW() - INTERVAL '45 days',
    st.id, 'PUBLISHED', 40, 'c0000000-0000-0000-0000-000000000003'::uuid, 15
FROM sport_types st WHERE st.code = 'TENNIS'
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Units for new resource groups (using deterministic UUIDs)
INSERT INTO units (id, tenant_id, group_id, unit_number, status, version, created_at) VALUES
    ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'SAN_01', 'ACTIVE', 0, NOW()),
    ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'SAN_02', 'ACTIVE', 0, NOW()),
    ('b2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'SAN_01', 'ACTIVE', 0, NOW()),
    ('b2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'SAN_02', 'ACTIVE', 0, NOW()),
    ('b3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'SAN_01', 'ACTIVE', 0, NOW())
ON CONFLICT (group_id, unit_number) DO NOTHING;

-- 3. Seed realistic bookings, reservations, multi-gateway payments, and BALANCED double-entry ledger journals
--    covering the trailing 7 days for real DB & Elasticsearch aggregation analytics.
DO $$
DECLARE
    d INT;
    slot_ts TIMESTAMPTZ;
    bk_id UUID;
    res_id UUID;
    pay_id UUID;
    jrn_id UUID;
    t_id UUID;
    g_id UUID;
    u_id UUID;
    price_val BIGINT;
    dep_val BIGINT;
    comm_val BIGINT;
    net_val BIGINT;
    gw_name TEXT;
    st_val TEXT;
    hour_offset INT;
BEGIN
    FOR d IN 0..6 LOOP
        -- Each day gets real bookings across morning, afternoon & prime evening hours
        FOR hour_offset IN SELECT unnest(ARRAY[8, 15, 19, 20]) LOOP
            slot_ts := date_trunc('day', NOW() - (d || ' days')::interval) + (hour_offset || ' hours')::interval;
            bk_id  := ('d' || lpad(d::text, 3, '0') || lpad(hour_offset::text, 4, '0') || '-0000-4000-8000-000000000001')::uuid;
            res_id := ('e' || lpad(d::text, 3, '0') || lpad(hour_offset::text, 4, '0') || '-0000-4000-8000-000000000001')::uuid;
            pay_id := ('f' || lpad(d::text, 3, '0') || lpad(hour_offset::text, 4, '0') || '-0000-4000-8000-000000000001')::uuid;
            jrn_id := ('9' || lpad(d::text, 3, '0') || lpad(hour_offset::text, 4, '0') || '-0000-4000-8000-000000000001')::uuid;

            IF hour_offset = 19 THEN
                t_id := '00000000-0000-0000-0000-000000000002'::uuid;
                g_id := 'a0000000-0000-0000-0000-000000000002'::uuid;
                u_id := 'b1000000-0000-0000-0000-000000000001'::uuid;
                price_val := 980000 + (d * 20000);
                gw_name := 'VNPAY_ESCROW';
            ELSIF hour_offset = 20 THEN
                t_id := '00000000-0000-0000-0000-000000000003'::uuid;
                g_id := 'a0000000-0000-0000-0000-000000000004'::uuid;
                u_id := 'b3000000-0000-0000-0000-000000000001'::uuid;
                price_val := 390000;
                gw_name := 'MOMO_WALLET';
            ELSIF hour_offset = 15 THEN
                t_id := '00000000-0000-0000-0000-000000000001'::uuid;
                g_id := 'a0000000-0000-0000-0000-000000000003'::uuid;
                u_id := 'b2000000-0000-0000-0000-000000000001'::uuid;
                price_val := 160000;
                gw_name := 'VIETQR_NAPAS';
            ELSE
                t_id := '00000000-0000-0000-0000-000000000001'::uuid;
                g_id := 'a0000000-0000-0000-0000-000000000001'::uuid;
                u_id := 'a0000000-0000-0000-0000-000000000001'::uuid;
                price_val := 220000 + (d * 10000);
                gw_name := 'VIETQR_NAPAS';
            END IF;

            dep_val := ROUND(price_val * 0.35);
            comm_val := ROUND(dep_val * 0.10);
            net_val := dep_val - comm_val;
            st_val := CASE WHEN d = 0 AND hour_offset >= 19 THEN 'CONFIRMED' ELSE 'COMPLETED' END;

            INSERT INTO bookings (id, tenant_id, user_id, status, currency, total_amount, deposit_total, contact_name, contact_phone, contact_email, created_at, updated_at)
            VALUES (
                bk_id, t_id, '20000000-0000-0000-0000-000000000001'::uuid, 'CONFIRMED', 'VND',
                price_val, dep_val, 'Nguyễn Minh Quân', '0988776655', 'khach.thuesan@arenapulse.vn',
                slot_ts - INTERVAL '3 hours', slot_ts - INTERVAL '2 hours'
            ) ON CONFLICT (id) DO NOTHING;

            INSERT INTO payments (id, tenant_id, booking_id, provider, provider_ref, amount, currency, status, payment_type, created_at, updated_at)
            VALUES (
                pay_id, t_id, bk_id, gw_name, 'SEED_' || d || '_' || hour_offset || '_' || replace(t_id::text, '-', ''),
                dep_val, 'VND', 'SUCCESS', 'DEPOSIT', slot_ts - INTERVAL '2 hours', slot_ts - INTERVAL '2 hours'
            ) ON CONFLICT (provider, provider_ref) DO NOTHING;

            INSERT INTO reservations (
                id, slot_start, tenant_id, booking_id, group_id, unit_id, status,
                locked_price, deposit_amount, pricing_audit, confirmed_at, checked_in_at, created_at, updated_at
            ) VALUES (
                res_id, slot_ts, t_id, bk_id, g_id, u_id, st_val,
                price_val, dep_val,
                jsonb_build_object('source', 'SEED_V10', 'hour', hour_offset),
                slot_ts - INTERVAL '2 hours',
                CASE WHEN st_val = 'COMPLETED' THEN slot_ts ELSE NULL END,
                slot_ts - INTERVAL '3 hours', slot_ts
            ) ON CONFLICT (id, slot_start) DO NOTHING;

            -- Insert strictly balanced double-entry journal if not yet created
            IF NOT EXISTS (SELECT 1 FROM ledger_journals WHERE idempotency_key = 'SEED_V10_JRN_' || d || '_' || hour_offset) THEN
                INSERT INTO ledger_journals (id, idempotency_key, tenant_id, reservation_id, payment_id, event_type, total_amount, currency, description, occurred_at)
                VALUES (
                    jrn_id,
                    'SEED_V10_JRN_' || d || '_' || hour_offset,
                    t_id, res_id, pay_id,
                    CASE WHEN st_val = 'COMPLETED' THEN 'RENTAL_COMPLETED' ELSE 'DEPOSIT_COLLECTED' END,
                    dep_val, 'VND',
                    'Seeded real operation journal',
                    slot_ts
                );

                IF st_val = 'COMPLETED' THEN
                    INSERT INTO ledger_entries (id, occurred_at, journal_id, tenant_id, reservation_id, payment_id, account_code, entry_type, direction, amount, currency) VALUES
                        (gen_random_uuid(), slot_ts, jrn_id, t_id, res_id, pay_id, 'GATEWAY_CLEARING', 'REVENUE', 'DEBIT', dep_val, 'VND'),
                        (gen_random_uuid(), slot_ts, jrn_id, t_id, res_id, pay_id, 'PLATFORM_ESCROW_LIABILITY', 'REVENUE', 'CREDIT', dep_val, 'VND'),
                        (gen_random_uuid(), slot_ts, jrn_id, t_id, res_id, pay_id, 'PLATFORM_ESCROW_LIABILITY', 'REVENUE', 'DEBIT', dep_val, 'VND'),
                        (gen_random_uuid(), slot_ts, jrn_id, t_id, res_id, pay_id, 'PLATFORM_COMMISSION_REVENUE', 'COMMISSION', 'CREDIT', comm_val, 'VND'),
                        (gen_random_uuid(), slot_ts, jrn_id, t_id, res_id, pay_id, 'VENUE_PAYABLE', 'REVENUE', 'CREDIT', net_val, 'VND');
                ELSE
                    INSERT INTO ledger_entries (id, occurred_at, journal_id, tenant_id, reservation_id, payment_id, account_code, entry_type, direction, amount, currency) VALUES
                        (gen_random_uuid(), slot_ts, jrn_id, t_id, res_id, pay_id, 'GATEWAY_CLEARING', 'REVENUE', 'DEBIT', dep_val, 'VND'),
                        (gen_random_uuid(), slot_ts, jrn_id, t_id, res_id, pay_id, 'PLATFORM_ESCROW_LIABILITY', 'REVENUE', 'CREDIT', dep_val, 'VND');
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END $$;

