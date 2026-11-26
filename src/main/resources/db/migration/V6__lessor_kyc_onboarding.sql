-- =====================================================================================
-- Dynamic Pricing & Yield Management Engine — Sports Venue Marketplace
-- Migration V6: Lessor Legal Compliance & KYC Onboarding Applications
-- =====================================================================================

CREATE TABLE IF NOT EXISTS lessor_applications (
    id                          UUID PRIMARY KEY,
    reference_code              VARCHAR(32) NOT NULL UNIQUE,
    applicant_user_id           UUID REFERENCES users(id),
    business_type               TEXT NOT NULL CHECK (business_type IN ('ENTERPRISE', 'HOUSEHOLD_BUSINESS')),
    legal_entity_name           VARCHAR(200) NOT NULL,
    representative_full_name    VARCHAR(150) NOT NULL,
    representative_dob          DATE NOT NULL,
    representative_gender       TEXT NOT NULL CHECK (representative_gender IN ('MALE', 'FEMALE')),
    cccd_number                 VARCHAR(12) NOT NULL,
    cccd_issue_date             DATE NOT NULL,
    cccd_issue_place            VARCHAR(200) NOT NULL,
    contact_phone               VARCHAR(20) NOT NULL,
    contact_email               CITEXT NOT NULL,
    tax_code                    VARCHAR(14) NOT NULL,
    business_license_number     VARCHAR(60) NOT NULL,
    business_license_issued_date DATE NOT NULL,
    venue_name                  VARCHAR(200) NOT NULL,
    venue_address               VARCHAR(300) NOT NULL,
    city                        VARCHAR(80) NOT NULL,
    district                    VARCHAR(80) NOT NULL,
    sport_codes                 VARCHAR(200) NOT NULL,
    total_courts                INT NOT NULL CHECK (total_courts BETWEEN 1 AND 100),
    property_right_type         TEXT NOT NULL CHECK (property_right_type IN ('OWNERSHIP_CERT', 'LEASE_WITH_SUBLEASE', 'PPP_CONCESSION')),
    property_document_number    VARCHAR(100) NOT NULL,
    property_expiry_date        DATE,
    pccc_certificate_number     VARCHAR(100) NOT NULL,
    fire_safety_confirmed       BOOLEAN NOT NULL,
    sport_safety_confirmed      BOOLEAN NOT NULL,
    business_doc_storage_key    VARCHAR(500),
    court_photo_storage_key     VARCHAR(500),
    bank_code                   VARCHAR(40) NOT NULL,
    bank_account_number         VARCHAR(30) NOT NULL,
    bank_account_holder         VARCHAR(160) NOT NULL,
    proposed_deposit_percent    SMALLINT NOT NULL CHECK (proposed_deposit_percent BETWEEN 20 AND 50),
    accepted_commission_rate    NUMERIC(5,2) NOT NULL CHECK (accepted_commission_rate BETWEEN 5.00 AND 25.00),
    legal_commitments_accepted  BOOLEAN NOT NULL,
    validation_summary          TEXT NOT NULL,
    status                      TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
                                    CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
    reviewed_by                 UUID REFERENCES users(id),
    review_note                 TEXT,
    provisioned_tenant_id       UUID REFERENCES tenants(id),
    reviewed_at                 TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lessor_apps_status_created
    ON lessor_applications (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lessor_apps_pending_tax
    ON lessor_applications (tax_code)
    WHERE status IN ('PENDING_REVIEW', 'APPROVED');

