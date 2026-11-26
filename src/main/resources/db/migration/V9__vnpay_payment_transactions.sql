-- =====================================================================================
-- Dynamic Pricing & Yield Management Engine — Sports Venue Marketplace
-- Migration V9: VNPAY Payment Gateway Transactions & Payment Type Alignment
-- =====================================================================================

ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_payment_type_check;

ALTER TABLE payments
    ADD CONSTRAINT payments_payment_type_check
    CHECK (payment_type IN ('DEPOSIT', 'BALANCE', 'FULL_SETTLEMENT', 'REFUND'));

CREATE TABLE IF NOT EXISTS vnpay_transactions (
    id                      UUID PRIMARY KEY,
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    booking_id              UUID NOT NULL REFERENCES bookings(id),
    reservation_id          UUID NOT NULL,
    payment_id              UUID REFERENCES payments(id),
    txn_ref                 VARCHAR(100) NOT NULL,
    order_info              VARCHAR(255) NOT NULL,
    order_type              VARCHAR(50) NOT NULL DEFAULT 'other',
    amount_vnd              BIGINT NOT NULL CHECK (amount_vnd > 0),
    vnp_amount              BIGINT NOT NULL CHECK (vnp_amount > 0),
    currency                BPCHAR(3) NOT NULL DEFAULT 'VND',
    locale                  VARCHAR(5) NOT NULL DEFAULT 'vn',
    bank_code               VARCHAR(30),
    card_type               VARCHAR(30),
    transaction_no          VARCHAR(40),
    response_code           VARCHAR(10),
    transaction_status      VARCHAR(10),
    pay_date                VARCHAR(14),
    create_date             VARCHAR(14) NOT NULL,
    expire_date             VARCHAR(14) NOT NULL,
    client_ip               VARCHAR(64) NOT NULL,
    status                  VARCHAR(24) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED')),
    secure_hash_valid       BOOLEAN NOT NULL DEFAULT false,
    raw_callback_payload    JSONB,
    last_query_dr_at        TIMESTAMPTZ,
    last_query_dr_payload   JSONB,
    version                 BIGINT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_vnpay_txn_ref UNIQUE (txn_ref),
    CONSTRAINT chk_vnpay_amount_multiplier CHECK (vnp_amount = amount_vnd * 100)
);

CREATE INDEX IF NOT EXISTS idx_vnpay_txn_reservation
    ON vnpay_transactions (reservation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vnpay_txn_booking
    ON vnpay_transactions (booking_id);

CREATE INDEX IF NOT EXISTS idx_vnpay_txn_status
    ON vnpay_transactions (status, created_at DESC);

