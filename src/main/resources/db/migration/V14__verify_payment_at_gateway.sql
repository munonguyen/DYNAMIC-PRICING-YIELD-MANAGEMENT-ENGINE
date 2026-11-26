ALTER TABLE payments ADD COLUMN gateway_verified_at TIMESTAMPTZ;

ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'REVIEW_REQUIRED'));

CREATE INDEX idx_payments_booking_verified ON payments (booking_id, gateway_verified_at DESC)
    WHERE gateway_verified_at IS NOT NULL;
