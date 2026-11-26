-- =====================================================================================
-- Dynamic Pricing & Yield Management Engine — Sports Venue Marketplace (Version 3.0)
-- Migration V3: Complete Identity/RBAC, Venue Catalogue, Deposit & Cancellation Tiers,
--               QR Check-in, Venue-Player Chat, Commission Rules & Double-Entry Ledger
-- Target DBMS: PostgreSQL 16+
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;

-- -------------------------------------------------------------------------------------
-- 0. APPEND-ONLY IMMUTABILITY TRIGGER FUNCTION (NFR-13, BR-CHAT-04, BR-COM-03)
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prevent_append_only_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Table % is append-only. UPDATE and DELETE operations are prohibited; use compensating entries.', TG_TABLE_NAME
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. IDENTITY & MULTI-SCOPE RBAC (PLATFORM-LEVEL)
-- -------------------------------------------------------------------------------------
CREATE TABLE users (
    id                      UUID PRIMARY KEY,
    username                CITEXT NOT NULL UNIQUE,
    email                   CITEXT NOT NULL UNIQUE,
    password_hash           VARCHAR(255) NOT NULL,
    first_name              VARCHAR(80) NOT NULL,
    last_name               VARCHAR(80) NOT NULL,
    phone                   VARCHAR(25),
    status                  TEXT NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION')),
    failed_login_attempts   SMALLINT NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    locked_until            TIMESTAMPTZ,
    email_verified_at       TIMESTAMPTZ,
    last_login_at           TIMESTAMPTZ,
    deactivated_at          TIMESTAMPTZ,
    deactivated_by          UUID REFERENCES users(id),
    version                 BIGINT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_inactive_audit
        CHECK (status <> 'INACTIVE' OR deactivated_at IS NOT NULL)
);

CREATE TABLE roles (
    id          SMALLSERIAL PRIMARY KEY,
    code        VARCHAR(30) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    scope       TEXT NOT NULL CHECK (scope IN ('PLATFORM', 'TENANT')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id          SMALLSERIAL PRIMARY KEY,
    code        VARCHAR(60) NOT NULL UNIQUE,
    description VARCHAR(200) NOT NULL
);

CREATE TABLE role_permissions (
    role_id         SMALLINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   SMALLINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id),
    role_id     SMALLINT NOT NULL REFERENCES roles(id),
    role_scope  TEXT NOT NULL CHECK (role_scope IN ('PLATFORM', 'TENANT')),
    tenant_id   UUID REFERENCES tenants(id),
    granted_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ,
    revoked_by  UUID REFERENCES users(id),
    CONSTRAINT chk_user_roles_scope_consistency
        CHECK ((role_scope = 'PLATFORM' AND tenant_id IS NULL)
            OR (role_scope = 'TENANT' AND tenant_id IS NOT NULL))
);

CREATE UNIQUE INDEX uq_user_roles_active
    ON user_roles (user_id, role_id, tenant_id) NULLS NOT DISTINCT
    WHERE revoked_at IS NULL;

CREATE INDEX idx_user_roles_tenant_active
    ON user_roles (tenant_id, role_id)
    WHERE revoked_at IS NULL AND tenant_id IS NOT NULL;

-- -------------------------------------------------------------------------------------
-- 2. MARKETPLACE CATALOGUE, VENUE SETTINGS & CANCELLATION POLICIES
-- -------------------------------------------------------------------------------------
CREATE TABLE sport_types (
    id          SMALLSERIAL PRIMARY KEY,
    code        VARCHAR(30) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETIRED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenants
    DROP CONSTRAINT IF EXISTS tenants_status_check,
    ADD COLUMN IF NOT EXISTS address VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(25),
    ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
    ADD COLUMN IF NOT EXISTS checkin_mode TEXT NOT NULL DEFAULT 'MANUAL'
        CHECK (checkin_mode IN ('QR_STAFF', 'MANUAL')),
    ADD COLUMN IF NOT EXISTS is_staff_chat_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE tenants SET status = 'SUSPENDED' WHERE status = 'SUSPEND';

ALTER TABLE tenants
    ADD CONSTRAINT chk_tenants_status CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    ADD CONSTRAINT chk_tenants_coordinates
        CHECK ((latitude IS NULL AND longitude IS NULL)
            OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));

CREATE TABLE cancellation_policies (
    id          UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        VARCHAR(100) NOT NULL,
    status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETIRED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_policy_tenant_name UNIQUE (tenant_id, name),
    CONSTRAINT uq_policy_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE cancellation_policy_tiers (
    policy_id           UUID NOT NULL REFERENCES cancellation_policies(id) ON DELETE CASCADE,
    min_hours_before    INT NOT NULL CHECK (min_hours_before >= 0),
    refund_percent      SMALLINT NOT NULL CHECK (refund_percent BETWEEN 0 AND 100),
    PRIMARY KEY (policy_id, min_hours_before)
);

-- -------------------------------------------------------------------------------------
-- 3. EXTEND INVENTORY, PRICING RULES & SECURITY KEYS
-- -------------------------------------------------------------------------------------
INSERT INTO sport_types (code, name, status)
VALUES ('PICKLEBALL', 'Pickleball', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE resource_groups
    ADD COLUMN IF NOT EXISTS sport_type_id SMALLINT REFERENCES sport_types(id),
    ADD COLUMN IF NOT EXISTS publish_status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (publish_status IN ('DRAFT', 'PUBLISHED', 'UNPUBLISHED')),
    ADD COLUMN IF NOT EXISTS deposit_percent SMALLINT NOT NULL DEFAULT 0
        CHECK (deposit_percent BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS cancellation_policy_id UUID,
    ADD COLUMN IF NOT EXISTS noshow_grace_minutes INT NOT NULL DEFAULT 15
        CHECK (noshow_grace_minutes BETWEEN 5 AND 120),
    ADD COLUMN IF NOT EXISTS balance_payment_mode TEXT NOT NULL DEFAULT 'AT_VENUE'
        CHECK (balance_payment_mode IN ('AT_VENUE', 'ONLINE_OPTIONAL'));

UPDATE resource_groups
SET sport_type_id = (SELECT id FROM sport_types WHERE code = 'PICKLEBALL')
WHERE sport_type_id IS NULL;

ALTER TABLE resource_groups
    ALTER COLUMN sport_type_id SET NOT NULL,
    ADD CONSTRAINT fk_group_policy_tenant
        FOREIGN KEY (tenant_id, cancellation_policy_id)
        REFERENCES cancellation_policies(tenant_id, id),
    ADD CONSTRAINT chk_deposit_requires_policy
        CHECK (deposit_percent = 0 OR cancellation_policy_id IS NOT NULL);

CREATE INDEX idx_resource_groups_discovery
    ON resource_groups (sport_type_id, tenant_id)
    WHERE publish_status = 'PUBLISHED' AND status = 'ACTIVE';

-- Prevent overlapping time-of-day brackets within the same rule set and day of week
ALTER TABLE time_of_day_factors
    ADD CONSTRAINT ex_tod_factor_overlap
    EXCLUDE USING gist (
        rule_set_id WITH =,
        day_of_week WITH =,
        int4range(from_hour::int, to_hour::int, '[)') WITH &&
    );

-- Separate signing key purpose (PRICE_LOCK vs QR_CHECKIN)
ALTER TABLE token_signing_keys
    ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'PRICE_LOCK'
        CHECK (purpose IN ('PRICE_LOCK', 'QR_CHECKIN'));

-- Tenant-safe composite FK and state invariants on unit_time_locks
ALTER TABLE units
    ADD CONSTRAINT uq_units_tenant_id UNIQUE (tenant_id, id);

ALTER TABLE unit_time_locks
    DROP CONSTRAINT IF EXISTS unit_time_locks_unit_id_fkey,
    ADD COLUMN IF NOT EXISTS slot_start TIMESTAMPTZ,
    ADD CONSTRAINT fk_locks_tenant_unit
        FOREIGN KEY (tenant_id, unit_id) REFERENCES units(tenant_id, id),
    ADD CONSTRAINT chk_locks_kind_invariants
        CHECK (
            (kind = 'HOLD' AND expires_at IS NOT NULL AND reservation_id IS NOT NULL)
            OR (kind = 'BOOKING' AND expires_at IS NULL AND reservation_id IS NOT NULL)
            OR (kind = 'MAINTENANCE')
        );

ALTER TABLE consumed_tokens
    ADD COLUMN IF NOT EXISTS user_id UUID;

-- -------------------------------------------------------------------------------------
-- 4. EXTEND BOOKINGS, RESERVATIONS, PAYMENTS & QR CHECK-IN
-- -------------------------------------------------------------------------------------
ALTER TABLE bookings
    RENAME COLUMN customer_id TO user_id;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS deposit_total BIGINT NOT NULL DEFAULT 0 CHECK (deposit_total >= 0);

ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS deposit_amount BIGINT NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
    ADD COLUMN IF NOT EXISTS refund_amount BIGINT NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
    ADD COLUMN IF NOT EXISTS forfeited_amount BIGINT NOT NULL DEFAULT 0 CHECK (forfeited_amount >= 0),
    ADD COLUMN IF NOT EXISTS policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS cancelled_by UUID,
    ADD COLUMN IF NOT EXISTS cancelled_by_role TEXT
        CHECK (cancelled_by_role IS NULL OR cancelled_by_role IN ('USER', 'MANAGER', 'ADMIN', 'SYSTEM')),
    ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS no_show_marked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS qr_jti UUID,
    ADD CONSTRAINT chk_reservation_deposit_bounds
        CHECK (deposit_amount <= locked_price),
    ADD CONSTRAINT chk_reservation_settlement_math
        CHECK (refund_amount + forfeited_amount <= deposit_amount);

CREATE INDEX IF NOT EXISTS idx_reservations_id_lookup ON reservations (id);
CREATE INDEX IF NOT EXISTS idx_reservations_user_slot ON reservations (user_id, slot_start DESC);

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'DEPOSIT'
        CHECK (payment_type IN ('DEPOSIT', 'BALANCE', 'REFUND')),
    ADD COLUMN IF NOT EXISTS related_payment_id UUID REFERENCES payments(id);

CREATE TABLE check_ins (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    reservation_id  UUID NOT NULL UNIQUE,
    slot_start      TIMESTAMPTZ NOT NULL,
    qr_jti          UUID UNIQUE,
    scanned_by      UUID NOT NULL REFERENCES users(id),
    method          TEXT NOT NULL CHECK (method IN ('QR_SCAN', 'MANUAL')),
    scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_checkin_qr_method
        CHECK ((method = 'QR_SCAN' AND qr_jti IS NOT NULL) OR (method = 'MANUAL'))
);

-- -------------------------------------------------------------------------------------
-- 5. VENUE-PLAYER IMMUTABLE CHAT (PARTITIONED MONTHLY)
-- -------------------------------------------------------------------------------------
CREATE TABLE conversations (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    booking_id      UUID REFERENCES bookings(id),
    status          TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_conversation_thread
    ON conversations (tenant_id, user_id, booking_id) NULLS NOT DISTINCT;

CREATE TABLE messages (
    id              UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    sender_user_id  UUID NOT NULL REFERENCES users(id),
    sender_role     TEXT NOT NULL CHECK (sender_role IN ('USER', 'MANAGER', 'STAFF')),
    body            TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE messages_default PARTITION OF messages DEFAULT;
CREATE INDEX idx_messages_conv_time ON messages (conversation_id, created_at DESC);

CREATE TRIGGER trg_messages_append_only
    BEFORE UPDATE OR DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_append_only_mutation();

CREATE TABLE conversation_reads (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

-- -------------------------------------------------------------------------------------
-- 6. COMMISSION RULES, DOUBLE-ENTRY APPEND-ONLY LEDGER & AUDIT LOGS
-- -------------------------------------------------------------------------------------
CREATE TABLE commission_rules (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID REFERENCES tenants(id),
    sport_type_id       SMALLINT REFERENCES sport_types(id),
    rate_percent        NUMERIC(5, 2) NOT NULL CHECK (rate_percent BETWEEN 0.00 AND 100.00),
    commission_basis    TEXT NOT NULL DEFAULT 'COLLECTED_DEPOSIT'
                        CHECK (commission_basis IN ('LOCKED_PRICE', 'COLLECTED_DEPOSIT')),
    applies_to_forfeit  BOOLEAN NOT NULL DEFAULT true,
    effective_period    TSTZRANGE NOT NULL,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETIRED')),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ex_commission_no_overlap EXCLUDE USING gist (
        COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
        COALESCE(sport_type_id, (-1)::smallint) WITH =,
        effective_period WITH &&
    ) WHERE (status = 'ACTIVE')
);

CREATE TABLE ledger_journals (
    id              UUID PRIMARY KEY,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    reservation_id  UUID,
    payment_id      UUID,
    event_type      TEXT NOT NULL
                    CHECK (event_type IN ('DEPOSIT_COLLECTED', 'RENTAL_COMPLETED', 'CANCELLATION_REFUND', 'DEPOSIT_FORFEITED', 'MANUAL_ADJUSTMENT')),
    total_amount    BIGINT NOT NULL CHECK (total_amount >= 0),
    currency        CHAR(3) NOT NULL DEFAULT 'VND',
    description     VARCHAR(255),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id)
);

CREATE TRIGGER trg_ledger_journals_append_only
    BEFORE UPDATE OR DELETE ON ledger_journals
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_append_only_mutation();

CREATE TABLE ledger_entries (
    id              UUID NOT NULL,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    journal_id      UUID NOT NULL REFERENCES ledger_journals(id),
    tenant_id       UUID NOT NULL,
    reservation_id  UUID,
    payment_id      UUID,
    account_code    TEXT NOT NULL
                    CHECK (account_code IN (
                        'GATEWAY_CLEARING',
                        'PLATFORM_ESCROW_LIABILITY',
                        'VENUE_PAYABLE',
                        'PLATFORM_COMMISSION_REVENUE',
                        'CUSTOMER_REFUND_PAYABLE',
                        'FORFEITED_DEPOSIT_REVENUE'
                    )),
    entry_type      TEXT NOT NULL
                    CHECK (entry_type IN ('REVENUE', 'COMMISSION', 'REFUND', 'FORFEITED_DEPOSIT', 'ADJUSTMENT')),
    direction       TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    amount          BIGINT NOT NULL CHECK (amount > 0),
    currency        CHAR(3) NOT NULL DEFAULT 'VND',
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE ledger_entries_default PARTITION OF ledger_entries DEFAULT;
CREATE INDEX idx_ledger_entries_tenant_time ON ledger_entries (tenant_id, occurred_at DESC);
CREATE INDEX idx_ledger_entries_journal ON ledger_entries (journal_id);

CREATE TRIGGER trg_ledger_entries_append_only
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_append_only_mutation();

CREATE TABLE audit_logs (
    id              UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_user_id   UUID,
    actor_role      VARCHAR(30),
    tenant_id       UUID,
    action          VARCHAR(60) NOT NULL,
    entity_type     VARCHAR(40) NOT NULL,
    entity_id       VARCHAR(80) NOT NULL,
    ip_address      VARCHAR(45),
    details         JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;
CREATE INDEX idx_audit_logs_tenant_time ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_time ON audit_logs (actor_user_id, created_at DESC);

CREATE TRIGGER trg_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_append_only_mutation();

