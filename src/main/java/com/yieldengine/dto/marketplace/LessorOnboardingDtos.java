package com.yieldengine.dto.marketplace;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class LessorOnboardingDtos {

    private LessorOnboardingDtos() {
    }

    public record OtpChallengeRequest(
            @NotBlank @Size(min = 10, max = 20) String contactPhone,
            @NotBlank @Email String contactEmail
    ) {
    }

    public record OtpChallengeResponse(
            UUID challengeId,
            String maskedTarget,
            long expiresInSeconds,
            String sandboxOtpHint
    ) {
    }

    public record OtpVerifyRequest(
            @NotNull UUID challengeId,
            @NotBlank @Pattern(regexp = "\\d{6}") String otpCode
    ) {
    }

    public record OtpVerifyResponse(
            boolean verified,
            String verificationToken,
            Instant verifiedAt
    ) {
    }

    public record SubmitLessorApplicationRequest(
            @NotBlank String otpVerificationToken,
            @NotBlank @Pattern(regexp = "ENTERPRISE|HOUSEHOLD_BUSINESS") String businessType,
            @NotBlank @Size(min = 3, max = 200) String legalEntityName,
            @NotBlank @Size(min = 3, max = 150) String representativeFullName,
            @NotNull LocalDate representativeDob,
            @NotBlank @Pattern(regexp = "MALE|FEMALE") String representativeGender,
            @NotBlank @Pattern(regexp = "\\d{12}") String cccdNumber,
            @NotNull LocalDate cccdIssueDate,
            @NotBlank @Size(min = 5, max = 200) String cccdIssuePlace,
            @NotBlank @Size(min = 10, max = 20) String contactPhone,
            @NotBlank @Email String contactEmail,
            @NotBlank @Size(min = 10, max = 14) String taxCode,
            @NotBlank @Size(min = 5, max = 60) String businessLicenseNumber,
            @NotNull LocalDate businessLicenseIssuedDate,
            @NotBlank @Size(min = 3, max = 200) String venueName,
            @NotBlank @Size(min = 8, max = 300) String venueAddress,
            @NotBlank @Size(min = 2, max = 80) String city,
            @NotBlank @Size(min = 2, max = 80) String district,
            @NotEmpty List<String> sportCodes,
            @Min(1) @Max(100) int totalCourts,
            @NotBlank @Pattern(regexp = "OWNERSHIP_CERT|LEASE_WITH_SUBLEASE|PPP_CONCESSION") String propertyRightType,
            @NotBlank @Size(min = 4, max = 100) String propertyDocumentNumber,
            LocalDate propertyExpiryDate,
            @NotBlank @Size(min = 4, max = 100) String pcccCertificateNumber,
            @AssertTrue(message = "Cơ sở bắt buộc đáp ứng điều kiện PCCC theo quy định.")
            boolean fireSafetyConfirmed,
            @AssertTrue(message = "Cơ sở vật chất phải đạt tiêu chuẩn hoạt động thể thao.")
            boolean sportSafetyConfirmed,
            @NotBlank @Size(min = 2, max = 40) String bankCode,
            @NotBlank @Pattern(regexp = "\\d{6,19}") String bankAccountNumber,
            @NotBlank @Size(min = 3, max = 160) String bankAccountHolder,
            @Min(20) @Max(50) short proposedDepositPercent,
            @NotNull @DecimalMin("8.00") @DecimalMax("20.00") BigDecimal acceptedCommissionRate,
            @AssertTrue(message = "Cần đồng ý đầy đủ các điều khoản hợp tác và ký quỹ.")
            boolean legalCommitmentsAccepted
    ) {
    }

    public record LessorApplicationReceiptResponse(
            UUID id,
            String referenceCode,
            String venueName,
            String legalEntityName,
            String status,
            Instant createdAt
    ) {
    }

    public record LessorApplicationResponse(
            UUID id,
            String referenceCode,
            String businessType,
            String legalEntityName,
            String representativeFullName,
            String maskedCccdNumber,
            String taxCode,
            String businessLicenseNumber,
            String venueName,
            String venueAddress,
            String city,
            String district,
            String sportCodes,
            int totalCourts,
            String propertyRightType,
            String propertyDocumentNumber,
            LocalDate propertyExpiryDate,
            String pcccCertificateNumber,
            String bankCode,
            String maskedBankAccountNumber,
            String bankAccountHolder,
            short proposedDepositPercent,
            BigDecimal acceptedCommissionRate,
            boolean otpVerified,
            short riskScore,
            String internalRiskFlags,
            String validationSummary,
            String status,
            UUID provisionedTenantId,
            String reviewNote,
            Instant createdAt,
            Instant reviewedAt
    ) {
    }

    public record ReviewLessorApplicationRequest(
            @NotBlank @Pattern(regexp = "APPROVED|REJECTED") String decision,
            @NotBlank @Size(min = 5, max = 500) String reviewNote
    ) {
    }
}
