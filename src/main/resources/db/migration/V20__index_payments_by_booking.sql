CREATE INDEX idx_payments_booking_created
    ON payments (booking_id, created_at DESC, id DESC);
