package com.yieldengine.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(
        name = "lessor_applications",
        indexes = {
                @Index(name = "idx_lessor_apps_status_created", columnList = "status, created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LessorApplication extends BaseEntity {

    @Column(name = "reference_code", nullable = false, unique = true, length = 32)
    private String referenceCode;

    @Column(name = "applicant_user_id")
    private UUID applicantUserId;

    @Column(name = "business_type", nullable = false)
    private String businessType;

    @Column(name = "legal_entity_name", nullable = false, length = 200)
    private String legalEntityName;

    @Column(name = "representative_full_name", nullable = false, length = 150)
    private String representativeFullName;

    @Column(name = "representative_dob", nullable = false)
    private LocalDate representativeDob;

    @Column(name = "representative_gender", nullable = false)
    private String representativeGender;

    @Column(name = "cccd_number", nullable = false, length = 12)
    private String cccdNumber;

    @Column(name = "cccd_issue_date", nullable = false)
    private LocalDate cccdIssueDate;

    @Column(name = "cccd_issue_place", nullable = false, length = 200)
    private String cccdIssuePlace;

    @Column(name = "contact_phone", nullable = false, length = 20)
    private String contactPhone;

    @Column(name = "contact_email", nullable = false)
    private String contactEmail;

    @Column(name = "tax_code", nullable = false, length = 14)
    private String taxCode;

    @Column(name = "business_license_number", nullable = false, length = 60)
    private String businessLicenseNumber;

    @Column(name = "business_license_issued_date", nullable = false)
    private LocalDate businessLicenseIssuedDate;

    @Column(name = "venue_name", nullable = false, length = 200)
    private String venueName;

    @Column(name = "venue_address", nullable = false, length = 300)
    private String venueAddress;

    @Column(name = "city", nullable = false, length = 80)
    private String city;

    @Column(name = "district", nullable = false, length = 80)
    private String district;

    @Column(name = "sport_codes", nullable = false, length = 200)
    private String sportCodes;

    @Column(name = "total_courts", nullable = false)
    private int totalCourts;

    @Column(name = "property_right_type", nullable = false)
    private String propertyRightType;

    @Column(name = "property_document_number", nullable = false, length = 100)
    private String propertyDocumentNumber;

    @Column(name = "property_expiry_date")
    private LocalDate propertyExpiryDate;

    @Column(name = "pccc_certificate_number", nullable = false, length = 100)
    private String pcccCertificateNumber;

    @Column(name = "fire_safety_confirmed", nullable = false)
    private boolean fireSafetyConfirmed;

    @Column(name = "sport_safety_confirmed", nullable = false)
    private boolean sportSafetyConfirmed;

    @Column(name = "business_doc_storage_key", length = 500)
    private String businessDocStorageKey;

    @Column(name = "court_photo_storage_key", length = 500)
    private String courtPhotoStorageKey;

    @Column(name = "cccd_front_storage_key", length = 500)
    private String cccdFrontStorageKey;

    @Column(name = "cccd_back_storage_key", length = 500)
    private String cccdBackStorageKey;

    @Column(name = "cccd_front_sha256", length = 64)
    private String cccdFrontSha256;

    @Column(name = "business_doc_sha256", length = 64)
    private String businessDocSha256;

    @Column(name = "court_photo_sha256", length = 64)
    private String courtPhotoSha256;

    @Column(name = "otp_verified_at")
    private Instant otpVerifiedAt;

    @Column(name = "risk_score", nullable = false)
    @Builder.Default
    private short riskScore = 0;

    @Column(name = "internal_risk_flags")
    private String internalRiskFlags;

    @Column(name = "bank_code", nullable = false, length = 40)
    private String bankCode;

    @Column(name = "bank_account_number", nullable = false, length = 30)
    private String bankAccountNumber;

    @Column(name = "bank_account_holder", nullable = false, length = 160)
    private String bankAccountHolder;

    @Column(name = "proposed_deposit_percent", nullable = false)
    private short proposedDepositPercent;

    @Column(name = "accepted_commission_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal acceptedCommissionRate;

    @Column(name = "legal_commitments_accepted", nullable = false)
    private boolean legalCommitmentsAccepted;

    @Column(name = "validation_summary", nullable = false)
    private String validationSummary;

    @Column(name = "status", nullable = false)
    @Builder.Default
    private String status = "PENDING_REVIEW";

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @Column(name = "review_note")
    private String reviewNote;

    @Column(name = "provisioned_tenant_id")
    private UUID provisionedTenantId;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;
}

