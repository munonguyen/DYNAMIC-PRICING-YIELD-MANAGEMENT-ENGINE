package com.yieldengine.validate;

import com.yieldengine.record.marketplace.SubmitLessorApplicationRequest;
import com.yieldengine.record.validate.InternalRiskAssessment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("LessorComplianceValidator Hardened Anti-Fraud Unit Tests")
class LessorComplianceValidatorTest {

    private final LessorComplianceValidator validator = new LessorComplianceValidator();

    private SubmitLessorApplicationRequest buildRequest(
            String entityName,
            String city,
            LocalDate dob,
            String cccd,
            LocalDate cccdIssueDate
    ) {
        return new SubmitLessorApplicationRequest(
                "otp-verified-token-sample",
                "ENTERPRISE",
                entityName,
                "Nguyễn Văn Minh",
                dob,
                "MALE",
                cccd,
                cccdIssueDate,
                "Cục Cảnh sát QLHC về TTXH",
                "0912345678",
                "minh@arenapulse.vn",
                "0100109106",
                "0100109106",
                LocalDate.of(2020, 3, 15),
                "Sân Pickleball Minh Đức",
                "Số 88 Láng Hạ, Đống Đa",
                city,
                "Đống Đa",
                List.of("PICKLEBALL", "BADMINTON"),
                6,
                "LEASE_WITH_SUBLEASE",
                "HĐT-2025-8812",
                LocalDate.now().plusDays(365),
                "PCCC-HN-2025-091",
                true,
                true,
                "VCB",
                "0011004567890",
                "CONG TY TNHH THE THAO ARENAPULSE",
                (short) 35,
                new BigDecimal("10.00"),
                true
        );
    }

    @Test
    @DisplayName("Passes all hardened checks cleanly with zero risk flags when attributes match")
    void validApplicationHasZeroRiskFlags() {
        InternalRiskAssessment res = validator.evaluateStrictAndScoreRisk(
                buildRequest(
                        "Cong Ty TNHH The Thao ArenaPulse",
                        "Hà Nội",
                        LocalDate.of(1992, 5, 14),
                        "001092004512",
                        LocalDate.of(2021, 7, 10)
                ),
                LocalDate.of(2026, 11, 25)
        );
        assertTrue(res.compliant(), () -> "Unexpected failure: " + res.blockingUserMessage());
        assertEquals(0, res.riskScore());
        assertTrue(res.internalFlags().isEmpty());
    }

    @Test
    @DisplayName("Flags tax province mismatch & CCCD renewal milestone internally for Admin inspection")
    void flagsInternalAnomaliesWithoutLeaking() {
        // Born 1980 (age 46), CCCD issued 2002 (age 22, past 25 & 40 renewal milestones), and Tax prefix 01 vs TP. HCM
        InternalRiskAssessment res = validator.evaluateStrictAndScoreRisk(
                buildRequest(
                        "Cong Ty TNHH The Thao ArenaPulse",
                        "TP. Hồ Chí Minh",
                        LocalDate.of(1980, 5, 14),
                        "001080004512",
                        LocalDate.of(2002, 7, 10)
                ),
                LocalDate.of(2026, 11, 25)
        );
        assertTrue(res.compliant());
        assertTrue(res.riskScore() >= 45);
        assertTrue(res.internalFlags().stream().anyMatch(f -> f.contains("CCCD_MAY_BE_PAST_RENEWAL_MILESTONE")));
        assertTrue(res.internalFlags().stream().anyMatch(f -> f.contains("TAX_PROVINCE_PREFIX_DIFFERS_FROM_CITY")));
    }

    @Test
    @DisplayName("Rejects invalid Vietnam Tax ID check digit, mismatched CCCD, HH spoofing & bank holder fraud")
    void rejectsInvalidTaxCccdAndBank() {
        assertTrue(LessorComplianceValidator.isValidVietnamTaxCode("0100109106"));
        assertTrue(LessorComplianceValidator.isValidVietnamTaxCode("0100109106-001"));
        assertFalse(LessorComplianceValidator.isValidVietnamTaxCode("0100109107"));

        assertFalse(LessorComplianceValidator.verifyCccdConsistency(
                "099092004512", LocalDate.of(1992, 5, 14), "MALE", null));
        assertFalse(LessorComplianceValidator.verifyCccdConsistency(
                "001192004512", LocalDate.of(1992, 5, 14), "MALE", "Hà Nội"));

        assertFalse(LessorComplianceValidator.verifyPropertyRights("LEASE_WITH_SUBLEASE", LocalDate.now().plusDays(90), LocalDate.now()));
        assertFalse(LessorComplianceValidator.isBankAccountHolderConsistent(
                "ENTERPRISE", "Cong Ty TNHH ABC", "Nguyễn Văn An", "TRAN VAN KHAC"));
    }
}
