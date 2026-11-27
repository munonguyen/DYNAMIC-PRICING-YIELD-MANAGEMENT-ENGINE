ALTER TABLE payments ADD COLUMN checkout_qr_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX uq_pending_vietqr_balance_per_booking
    ON payments (booking_id)
    WHERE payment_type = 'BALANCE' AND provider = 'VIETQR_NAPAS'
      AND status = 'PENDING' AND checkout_qr_expires_at IS NOT NULL;

ALTER TABLE ledger_journals DROP CONSTRAINT ledger_journals_event_type_check;
ALTER TABLE ledger_journals ADD CONSTRAINT ledger_journals_event_type_check
    CHECK (event_type IN ('DEPOSIT_COLLECTED', 'BALANCE_COLLECTED', 'RENTAL_COMPLETED',
                         'CANCELLATION_REFUND', 'DEPOSIT_FORFEITED', 'MANUAL_ADJUSTMENT'));
