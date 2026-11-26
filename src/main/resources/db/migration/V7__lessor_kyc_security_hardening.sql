-- =====================================================================================
-- Dynamic Pricing & Yield Management Engine — Sports Venue Marketplace
-- Migration V7: Lessor KYC Anti-Fraud Hardening (OTP Challenge, CCCD Front/Back & File Hashes)
-- =====================================================================================

ALTER TABLE lessor_applications
    ADD COLUMN IF NOT EXISTS cccd_front_storage_key VARCHAR(500),
    ADD COLUMN IF NOT EXISTS cccd_back_storage_key VARCHAR(500),
    ADD COLUMN IF NOT EXISTS cccd_front_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS business_doc_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS court_photo_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS risk_score SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS internal_risk_flags TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lessor_apps_active_cccd
    ON lessor_applications (cccd_number)
    WHERE status IN ('PENDING_REVIEW', 'APPROVED');

CREATE TABLE IF NOT EXISTS lessor_otp_verifications (
    id                  UUID PRIMARY KEY,
    contact_phone       VARCHAR(20) NOT NULL,
    contact_email       CITEXT NOT NULL,
    otp_sha256          VARCHAR(64) NOT NULL,
    verification_token  VARCHAR(64),
    attempts            INT NOT NULL DEFAULT 0,
    expires_at          TIMESTAMPTZ NOT NULL,
    verified_at         TIMESTAMPTZ,
    consumed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lessor_otp_token
    ON lessor_otp_verifications (verification_token)
    WHERE verification_token IS NOT NULL;

