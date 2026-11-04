-- Dynamic Pricing & Yield Management Engine
-- Schema Migration V1: PostgreSQL 16
-- Physical Integrity, Constraints, btree_gist Exclusion Constraint

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. RESOURCE GROUPS (Cụm tài nguyên / sân bãi)
CREATE TABLE resource_groups (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    total_units INT NOT NULL CHECK (total_units > 0),
    base_price NUMERIC(12, 2) NOT NULL,
    min_price NUMERIC(12, 2) NOT NULL,
    max_price NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_price_bounds CHECK (min_price <= base_price AND base_price <= max_price)
);

-- 2. PHYSICAL UNITS (Từng sân vật lý trong cụm)
CREATE TABLE units (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES resource_groups(id) ON DELETE CASCADE,
    unit_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'RETIRED')),
    UNIQUE(group_id, unit_number)
);

-- 3. TIME SLOTS (Khung giờ kinh doanh)
CREATE TABLE time_slots (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES resource_groups(id) ON DELETE CASCADE,
    slot_start TIMESTAMPTZ NOT NULL,
    slot_end TIMESTAMPTZ NOT NULL,
    total_capacity INT NOT NULL CHECK (total_capacity > 0),
    reserved_count INT NOT NULL DEFAULT 0,
    context_multiplier NUMERIC(5, 3) NOT NULL DEFAULT 1.000,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_capacity_bounds CHECK (reserved_count >= 0 AND reserved_count <= total_capacity),
    CONSTRAINT chk_slot_time_order CHECK (slot_end > slot_start),
    UNIQUE(group_id, slot_start, slot_end)
);

-- 4. YIELD MATRIX RULES (Ma trận hệ số 2 chiều: Occupancy % x Lead Time Hours)
CREATE TABLE yield_matrix_rules (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES resource_groups(id) ON DELETE CASCADE,
    rule_name VARCHAR(100) NOT NULL,
    min_occupancy_pct NUMERIC(5, 2) NOT NULL,
    max_occupancy_pct NUMERIC(5, 2) NOT NULL,
    min_lead_hours NUMERIC(7, 2) NOT NULL,
    max_lead_hours NUMERIC(7, 2) NOT NULL,
    multiplier NUMERIC(5, 3) NOT NULL,
    priority INT NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_multiplier_range CHECK (multiplier BETWEEN 0.300 AND 3.000)
);

CREATE INDEX idx_yield_matrix_lookup 
ON yield_matrix_rules(group_id, active, min_occupancy_pct, max_occupancy_pct, min_lead_hours, max_lead_hours);

-- 5. SLOT PRICE SNAPSHOTS (Bảng giá hiện hành & audit hệ số)
CREATE TABLE slot_price_snapshots (
    slot_id UUID PRIMARY KEY REFERENCES time_slots(id) ON DELETE CASCADE,
    current_price NUMERIC(12, 2) NOT NULL,
    applied_factors JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. RESERVATIONS (Đơn đặt chỗ / Giữ sân)
CREATE TABLE reservations (
    id UUID PRIMARY KEY,
    unit_id UUID NOT NULL REFERENCES units(id),
    slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES resource_groups(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    booking_period TSTZRANGE NOT NULL,
    locked_price NUMERIC(12, 2) NOT NULL,
    pricing_audit JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
    hold_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_held_expires CHECK (status != 'HELD' OR hold_expires_at IS NOT NULL),
    CONSTRAINT ex_no_double_booking EXCLUDE USING gist (
        unit_id WITH =,
        booking_period WITH &&
    ) WHERE (status IN ('HELD', 'CONFIRMED'))
);

CREATE INDEX idx_reservations_slot ON reservations(slot_id, status);
CREATE INDEX idx_reservations_user ON reservations(user_id);

-- 7. CONSUMED TOKENS (Chống Replay Attack)
CREATE TABLE consumed_tokens (
    token_jti UUID PRIMARY KEY,
    reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
