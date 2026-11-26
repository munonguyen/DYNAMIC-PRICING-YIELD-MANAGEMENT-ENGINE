-- V11: Support per-listing check-in mode (QR_STAFF vs PIN_COUNTER no-scanner option)
--      and single-use salted PIN verification with brute-force lockout protection.

ALTER TABLE resource_groups
    ADD COLUMN IF NOT EXISTS checkin_mode TEXT NOT NULL DEFAULT 'QR_STAFF'
        CHECK (checkin_mode IN ('QR_STAFF', 'PIN_COUNTER', 'MANUAL'));

-- Sync existing listings' initial mode from their tenant profile
UPDATE resource_groups rg
SET checkin_mode = CASE
    WHEN t.checkin_mode = 'PIN_COUNTER' THEN 'PIN_COUNTER'
    WHEN t.checkin_mode = 'MANUAL' THEN 'PIN_COUNTER'
    ELSE 'QR_STAFF'
END
FROM tenants t
WHERE rg.tenant_id = t.id;

-- Allow PIN_COUNTER on tenants & check_ins while keeping backward compatibility with QR_STAFF/MANUAL
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_checkin_mode_check;
ALTER TABLE tenants
    ADD CONSTRAINT tenants_checkin_mode_check
        CHECK (checkin_mode IN ('QR_STAFF', 'PIN_COUNTER', 'MANUAL'));

ALTER TABLE check_ins DROP CONSTRAINT IF EXISTS check_ins_method_check;
ALTER TABLE check_ins
    ADD CONSTRAINT check_ins_method_check
        CHECK (method IN ('QR_SCAN', 'PIN_COUNTER', 'MANUAL'));

ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS checkin_pin_hash TEXT,
    ADD COLUMN IF NOT EXISTS checkin_pin_hint VARCHAR(16),
    ADD COLUMN IF NOT EXISTS pin_failed_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pin_consumed_at TIMESTAMPTZ;
