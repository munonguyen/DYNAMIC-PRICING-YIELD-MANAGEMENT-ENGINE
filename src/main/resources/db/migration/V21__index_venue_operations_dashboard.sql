CREATE INDEX idx_payments_tenant_verified_revenue
    ON payments (tenant_id, gateway_verified_at) INCLUDE (payment_type, amount)
    WHERE status = 'SUCCESS' AND gateway_verified_at IS NOT NULL;

CREATE INDEX idx_reservations_tenant_checked_in
    ON reservations (tenant_id, checked_in_at)
    WHERE checked_in_at IS NOT NULL;
