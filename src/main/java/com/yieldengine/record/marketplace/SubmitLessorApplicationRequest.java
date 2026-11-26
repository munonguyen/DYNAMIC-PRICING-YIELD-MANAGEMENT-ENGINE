package com.yieldengine.record.marketplace;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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
