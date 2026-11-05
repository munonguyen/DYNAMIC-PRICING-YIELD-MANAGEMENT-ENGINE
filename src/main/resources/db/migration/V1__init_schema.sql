-- Dynamic Pricing & Yield Management Engine
-- Schema Migration V2: High-Scale Multi-Tenant, Partitioned, Physical GiST Integrity
-- Reference Architecture: Kill Bill, Amadeus RM, Cal.com

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. TENANTS (Đơn vị khách hàng thuê hệ thống multi-tenant)
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPEND')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. IDEMPOTENCY KEYS (Chống gọi trùng lặp Request Retry)
CREATE TABLE idempotency_keys (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    idem_key VARCHAR(100) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    response_code SMALLINT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, idem_key)
);

-- 3. OUTBOX EVENTS (Transactional Outbox Pattern - Relay đọc SKIP LOCKED)
CREATE TABLE outbox_events (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aggregate_type VARCHAR(40) NOT NULL,
    aggregate_id VARCHAR(80) NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    attempts INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_outbox_unprocessed ON outbox_events(published_at, id) WHERE published_at IS NULL;

-- 4. TOKEN SIGNING KEYS (Xoay khóa ký token HMAC)
CREATE TABLE token_signing_keys (
    kid VARCHAR(40) PRIMARY KEY,
    secret_ref VARCHAR(200) NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'VERIFY_ONLY', 'REVOKED')),
    not_before TIMESTAMPTZ NOT NULL DEFAULT now(),
    not_after TIMESTAMPTZ NOT NULL
);

-- 5. RESOURCE GROUPS (Cụm sân bãi / tài nguyên)
CREATE TABLE resource_groups (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    slot_minutes INT NOT NULL DEFAULT 60 CHECK (slot_minutes IN (30, 60, 90, 120)),
    hold_ttl_seconds INT NOT NULL DEFAULT 600 CHECK (hold_ttl_seconds BETWEEN 60 AND 3600),
    base_price BIGINT NOT NULL CHECK (base_price > 0),
    min_price BIGINT NOT NULL CHECK (min_price > 0),
    max_price BIGINT NOT NULL CHECK (max_price >= min_price),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETIRED')),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_group_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_group_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT chk_price_bounds CHECK (min_price <= base_price AND base_price <= max_price)
);

-- 6. PHYSICAL UNITS (Từng sân vật lý trong cụm)
CREATE TABLE units (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    group_id UUID NOT NULL,
    unit_number VARCHAR(20) NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'RETIRED')),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_units_group FOREIGN KEY (tenant_id, group_id) REFERENCES resource_groups(tenant_id, id),
    CONSTRAINT uq_unit_group_number UNIQUE (group_id, unit_number)
);

-- 7. YIELD RULE SETS (Phiên bản luật giá có khoảng hiệu lực)
CREATE TABLE yield_rule_sets (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    group_id UUID NOT NULL,
    version_no INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
    effective TSTZRANGE NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_ruleset_group FOREIGN KEY (tenant_id, group_id) REFERENCES resource_groups(tenant_id, id),
    CONSTRAINT uq_ruleset_group_version UNIQUE (group_id, version_no),
    CONSTRAINT ex_active_ruleset EXCLUDE USING gist (group_id WITH =, effective WITH &&) WHERE (status = 'ACTIVE')
);

-- 8. YIELD MATRIX RULES (Ô ma trận giá NUMRANGE - GiST chống chồng ô)
CREATE TABLE yield_matrix_rules (
    id UUID PRIMARY KEY,
    rule_set_id UUID NOT NULL REFERENCES yield_rule_sets(id) ON DELETE CASCADE,
    rule_name VARCHAR(100) NOT NULL,
    occupancy_pct NUMRANGE NOT NULL,
    lead_hours NUMRANGE NOT NULL,
    multiplier NUMERIC(6, 4) NOT NULL CHECK (multiplier BETWEEN 0.3000 AND 3.0000),
    CONSTRAINT ex_matrix_cell_overlap EXCLUDE USING gist (rule_set_id WITH =, occupancy_pct WITH &&, lead_hours WITH &&)
);

-- 9. TIME OF DAY FACTORS (Hệ số theo khung giờ & ngày trong tuần)
CREATE TABLE time_of_day_factors (
    id UUID PRIMARY KEY,
    rule_set_id UUID NOT NULL REFERENCES yield_rule_sets(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    from_hour SMALLINT NOT NULL CHECK (from_hour BETWEEN 0 AND 23),
    to_hour SMALLINT NOT NULL CHECK (to_hour BETWEEN 1 AND 24 AND to_hour > from_hour),
    multiplier NUMERIC(6, 4) NOT NULL CHECK (multiplier BETWEEN 0.3000 AND 3.0000)
);

-- 10. CONTEXT FACTORS (Hệ số ngoại cảnh: sự kiện, thời tiết, lễ tết)
CREATE TABLE context_factors (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    group_id UUID NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('WEATHER', 'HOLIDAY', 'EVENT', 'SPECIAL')),
    period TSTZRANGE NOT NULL,
    multiplier NUMERIC(6, 4) NOT NULL CHECK (multiplier BETWEEN 0.3000 AND 3.0000),
    source VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_context_factors_group FOREIGN KEY (tenant_id, group_id) REFERENCES resource_groups(tenant_id, id)
);
CREATE INDEX idx_context_factors_gist ON context_factors USING gist (group_id, period);

-- 11. BOOKINGS (Đơn đặt chỗ gom nhiều sân/giờ)
CREATE TABLE bookings (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED')),
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    total_amount BIGINT NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    idempotency_key VARCHAR(100),
    expires_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_booking_tenant_idem UNIQUE (tenant_id, idempotency_key)
);

-- 12. PAYMENTS (Giao dịch thanh toán Webhook)
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    provider VARCHAR(30) NOT NULL,
    provider_ref VARCHAR(100) NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_provider_ref UNIQUE (provider, provider_ref)
);

-- 13. TIME SLOTS (Partitioned by RANGE on slot_start)
CREATE TABLE time_slots (
    group_id UUID NOT NULL,
    slot_start TIMESTAMPTZ NOT NULL,
    tenant_id UUID NOT NULL,
    slot_end TIMESTAMPTZ NOT NULL,
    total_capacity INT NOT NULL CHECK (total_capacity > 0),
    context_multiplier NUMERIC(6, 4) NOT NULL DEFAULT 1.0000 CHECK (context_multiplier BETWEEN 0.3000 AND 3.0000),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, slot_start),
    CONSTRAINT fk_timeslot_group FOREIGN KEY (tenant_id, group_id) REFERENCES resource_groups(tenant_id, id),
    CONSTRAINT chk_timeslot_end CHECK (slot_end > slot_start)
) PARTITION BY RANGE (slot_start);

CREATE TABLE time_slots_default PARTITION OF time_slots DEFAULT;

-- 14. SLOT INVENTORY (Partitioned by RANGE on slot_start, fillfactor=70)
CREATE TABLE slot_inventory (
    group_id UUID NOT NULL,
    slot_start TIMESTAMPTZ NOT NULL,
    tenant_id UUID NOT NULL,
    held_count INT NOT NULL DEFAULT 0 CHECK (held_count >= 0),
    confirmed_count INT NOT NULL DEFAULT 0 CHECK (confirmed_count >= 0),
    total_capacity INT NOT NULL CHECK (total_capacity > 0),
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, slot_start),
    CONSTRAINT fk_slot_inventory_slot FOREIGN KEY (group_id, slot_start) REFERENCES time_slots(group_id, slot_start) ON DELETE CASCADE,
    CONSTRAINT chk_slot_inventory_capacity CHECK (held_count + confirmed_count <= total_capacity)
) PARTITION BY RANGE (slot_start);

CREATE TABLE slot_inventory_default PARTITION OF slot_inventory DEFAULT WITH (fillfactor = 70);

-- 15. SLOT PRICE CURRENT (Partitioned by RANGE on slot_start)
CREATE TABLE slot_price_current (
    group_id UUID NOT NULL,
    slot_start TIMESTAMPTZ NOT NULL,
    tenant_id UUID NOT NULL,
    current_price BIGINT NOT NULL CHECK (current_price > 0),
    rule_set_id UUID NOT NULL REFERENCES yield_rule_sets(id),
    applied_factors JSONB NOT NULL,
    price_seq BIGINT NOT NULL DEFAULT 1,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, slot_start),
    CONSTRAINT fk_slot_price_current_slot FOREIGN KEY (group_id, slot_start) REFERENCES time_slots(group_id, slot_start) ON DELETE CASCADE
) PARTITION BY RANGE (slot_start);

CREATE TABLE slot_price_current_default PARTITION OF slot_price_current DEFAULT;

-- 16. SLOT PRICE HISTORY (Partitioned by RANGE on computed_at, BRIN index)
CREATE TABLE slot_price_history (
    id BIGSERIAL NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    group_id UUID NOT NULL,
    slot_start TIMESTAMPTZ NOT NULL,
    tenant_id UUID NOT NULL,
    price BIGINT NOT NULL,
    rule_set_id UUID,
    applied_factors JSONB NOT NULL,
    trigger_event TEXT NOT NULL,
    PRIMARY KEY (id, computed_at)
) PARTITION BY RANGE (computed_at);

CREATE TABLE slot_price_history_default PARTITION OF slot_price_history DEFAULT;
CREATE INDEX idx_slot_price_history_brin ON slot_price_history USING BRIN (computed_at);

-- 17. RESERVATIONS (Partitioned by RANGE on slot_start)
CREATE TABLE reservations (
    id UUID NOT NULL,
    slot_start TIMESTAMPTZ NOT NULL,
    tenant_id UUID NOT NULL,
    booking_id UUID,
    group_id UUID NOT NULL,
    unit_id UUID NOT NULL REFERENCES units(id),
    status TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')),
    locked_price BIGINT NOT NULL CHECK (locked_price > 0),
    pricing_audit JSONB NOT NULL,
    token_jti UUID,
    hold_expires_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason VARCHAR(100),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, slot_start),
    CONSTRAINT chk_reservation_held_expire CHECK (status != 'HELD' OR hold_expires_at IS NOT NULL)
) PARTITION BY RANGE (slot_start);

CREATE TABLE reservations_default PARTITION OF reservations DEFAULT;
CREATE INDEX idx_reservations_booking ON reservations (booking_id);
CREATE INDEX idx_reservations_unit_status ON reservations (unit_id, status);

-- 18. CONSUMED TOKENS (Chống Replay Attack)
CREATE TABLE consumed_tokens (
    token_jti UUID PRIMARY KEY,
    kid VARCHAR(40) REFERENCES token_signing_keys(kid),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    reservation_id UUID,
    token_expires TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. UNIT TIME LOCKS (Nguồn sự thật chống đặt trùng - GiST Exclusion)
CREATE TABLE unit_time_locks (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    unit_id UUID NOT NULL REFERENCES units(id),
    period TSTZRANGE NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('HOLD', 'BOOKING', 'MAINTENANCE')),
    reservation_id UUID UNIQUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ex_no_double_booking EXCLUDE USING gist (unit_id WITH =, period WITH &&)
);
