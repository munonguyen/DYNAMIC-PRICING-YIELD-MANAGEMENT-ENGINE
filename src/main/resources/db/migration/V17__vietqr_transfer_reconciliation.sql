CREATE TABLE vietqr_bank_transfers (
    id UUID PRIMARY KEY,
    mode VARCHAR(8) NOT NULL CHECK (mode IN ('SANDBOX', 'LIVE')),
    transaction_id VARCHAR(128) NOT NULL,
    reference_number VARCHAR(128) NOT NULL,
    bank_account VARCHAR(40) NOT NULL,
    direction CHAR(1) NOT NULL CHECK (direction IN ('C', 'D')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    content VARCHAR(255) NOT NULL,
    order_code VARCHAR(13) NOT NULL,
    transaction_time TIMESTAMPTZ NOT NULL,
    reservation_id UUID,
    status VARCHAR(20) NOT NULL CHECK (status IN ('REVIEW_REQUIRED', 'APPLIED', 'IGNORED', 'RESOLVED')),
    reason VARCHAR(40),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolution_note VARCHAR(500),
    resolved_by UUID REFERENCES users (id),
    resolved_at TIMESTAMPTZ,
    UNIQUE (mode, transaction_id),
    UNIQUE (mode, bank_account, direction, reference_number)
);

CREATE INDEX idx_vietqr_transfer_review ON vietqr_bank_transfers (mode, received_at DESC, id)
    WHERE status = 'REVIEW_REQUIRED';

CREATE INDEX idx_vietqr_transfer_booking_review ON vietqr_bank_transfers (reservation_id, mode)
    WHERE status = 'REVIEW_REQUIRED';

CREATE UNIQUE INDEX uq_vietqr_payment_transfer_content
    ON payments ((raw_payload->>'mode'), (raw_payload->>'bankAccount'), (raw_payload->>'content'))
    WHERE provider = 'VIETQR_NAPAS' AND raw_payload IS NOT NULL;
