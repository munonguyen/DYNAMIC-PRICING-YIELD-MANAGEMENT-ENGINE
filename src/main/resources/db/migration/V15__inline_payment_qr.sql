ALTER TABLE payments
    ADD COLUMN checkout_qr_payload VARCHAR(1024),
    ADD COLUMN checkout_qr_sandbox BOOLEAN;
