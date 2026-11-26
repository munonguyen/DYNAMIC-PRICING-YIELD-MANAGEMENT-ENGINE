ALTER TABLE reservations
    DROP CONSTRAINT chk_reservation_settlement_math,
    ADD CONSTRAINT chk_reservation_settlement_math CHECK (
        refund_amount + forfeited_amount <= locked_price
        AND forfeited_amount <= deposit_amount
    );
