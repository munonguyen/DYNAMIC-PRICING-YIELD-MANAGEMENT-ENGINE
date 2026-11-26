-- =====================================================================================
-- Dynamic Pricing & Yield Management Engine — Sports Venue Marketplace
-- Migration V8: Booking Contact Details for E-Ticket Delivery & QR Email Audit
-- =====================================================================================

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS contact_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(25),
    ADD COLUMN IF NOT EXISTS contact_email CITEXT,
    ADD COLUMN IF NOT EXISTS need_vat_invoice BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS vat_company_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS vat_tax_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS booking_note VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_bookings_user_created
    ON bookings (user_id, created_at DESC);

