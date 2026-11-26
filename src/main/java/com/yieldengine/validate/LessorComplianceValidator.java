package com.yieldengine.validate;

import com.yieldengine.dto.marketplace.LessorOnboardingDtos.SubmitLessorApplicationRequest;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Internal statutory KYC & anti-fraud engine (never exposes validation rules/formulas to untrusted clients).
 */
@Component
public class LessorComplianceValidator {

    private static final Pattern PHONE_VN_PATTERN =
            Pattern.compile("^0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])\\d{7}$");
    private static final Pattern TAX_CODE_PATTERN =
            Pattern.compile("^\\d{10}(-\\d{3})?$");
    private static final int[] MST_WEIGHTS = {31, 29, 23, 19, 17, 13, 7, 5, 3};

    public static final Map<String, String> CCCD_PROVINCE_CODES = Map.ofEntries(
            Map.entry("001", "Hà Nội"), Map.entry("002", "Hà Giang"), Map.entry("004", "Cao Bằng"),
            Map.entry("006", "Bắc Kạn"), Map.entry("008", "Tuyên Quang"), Map.entry("010", "Lào Cai"),
            Map.entry("011", "Điện Biên"), Map.entry("012", "Lai Châu"), Map.entry("014", "Sơn La"),
            Map.entry("015", "Yên Bái"), Map.entry("017", "Hòa Bình"), Map.entry("019", "Thái Nguyên"),
            Map.entry("020", "Lạng Sơn"), Map.entry("022", "Quảng Ninh"), Map.entry("024", "Bắc Giang"),
            Map.entry("025", "Phú Thọ"), Map.entry("026", "Vĩnh Phúc"), Map.entry("027", "Bắc Ninh"),
            Map.entry("030", "Hải Dương"), Map.entry("031", "Hải Phòng"), Map.entry("033", "Hưng Yên"),
            Map.entry("034", "Thái Bình"), Map.entry("035", "Hà Nam"), Map.entry("036", "Nam Định"),
            Map.entry("037", "Ninh Bình"), Map.entry("038", "Thanh Hóa"), Map.entry("040", "Nghệ An"),
            Map.entry("042", "Hà Tĩnh"), Map.entry("044", "Quảng Bình"), Map.entry("045", "Quảng Trị"),
            Map.entry("046", "Thừa Thiên Huế"), Map.entry("048", "Đà Nẵng"), Map.entry("049", "Quảng Nam"),
            Map.entry("051", "Quảng Ngãi"), Map.entry("052", "Bình Định"), Map.entry("054", "Phú Yên"),
            Map.entry("056", "Khánh Hòa"), Map.entry("058", "Ninh Thuận"), Map.entry("060", "Bình Thuận"),
            Map.entry("062", "Kon Tum"), Map.entry("064", "Gia Lai"), Map.entry("066", "Đắk Lắk"),
            Map.entry("067", "Đắk Nông"), Map.entry("068", "Lâm Đồng"), Map.entry("070", "Bình Phước"),
            Map.entry("072", "Tây Ninh"), Map.entry("074", "Bình Dương"), Map.entry("075", "Đồng Nai"),
            Map.entry("077", "Bà Rịa - Vũng Tàu"), Map.entry("079", "TP. Hồ Chí Minh"), Map.entry("080", "Long An"),
            Map.entry("082", "Tiền Giang"), Map.entry("083", "Bến Tre"), Map.entry("084", "Trà Vinh"),
            Map.entry("086", "Vĩnh Long"), Map.entry("087", "Đồng Tháp"), Map.entry("089", "An Giang"),
            Map.entry("091", "Kiên Giang"), Map.entry("092", "Cần Thơ"), Map.entry("093", "Hậu Giang"),
            Map.entry("094", "Sóc Trăng"), Map.entry("095", "Bạc Liêu"), Map.entry("096", "Cà Mau")
    );

    public record InternalRiskAssessment(
            boolean compliant,
            short riskScore,
            String cccdProvinceName,
            List<String> internalFlags,
            String blockingUserMessage
    ) {
    }

    public InternalRiskAssessment evaluateStrictAndScoreRisk(SubmitLessorApplicationRequest req, LocalDate today) {
        List<String> blockingErrors = new ArrayList<>();
        List<String> riskFlags = new ArrayList<>();
        int score = 0;

        // 1. Civil capacity age >= 18
        int age = Period.between(req.representativeDob(), today).getYears();
        if (req.representativeDob().isAfter(today) || age < 18 || age > 95) {
            blockingErrors.add("Người đại diện phải đủ 18 tuổi trở lên và có ngày sinh hợp lệ.");
        }

        // 2. CCCD structure + DOB/Gender cross-check + issue age >= 14 + age 25/40/60 expiry signal
        String cccd = req.cccdNumber().trim();
        String provinceCode = cccd.length() == 12 ? cccd.substring(0, 3) : "";
        String provinceName = CCCD_PROVINCE_CODES.get(provinceCode);
        boolean cccdValid = verifyCccdConsistency(cccd, req.representativeDob(), req.representativeGender(), provinceName);
        boolean issueDateValid = !req.cccdIssueDate().isAfter(today)
                && Period.between(req.representativeDob(), req.cccdIssueDate()).getYears() >= 14;
        if (!cccdValid || !issueDateValid) {
            blockingErrors.add("Số CCCD, ngày sinh, giới tính hoặc ngày cấp không đồng nhất.");
        } else {
            // Check Luật Căn cước 2023 mandatory card renewal ages (25, 40, 60) if issued > 2 years past milestone
            int issueAge = Period.between(req.representativeDob(), req.cccdIssueDate()).getYears();
            if ((age >= 27 && issueAge < 23) || (age >= 42 && issueAge < 38) || (age >= 62 && issueAge < 58)) {
                score += 25;
                riskFlags.add("CCCD_MAY_BE_PAST_RENEWAL_MILESTONE(age=" + age + ",issuedAtAge=" + issueAge + ")");
            }
        }

        // 3. Vietnam Tax Code check (TT 105/2020/TT-BTC)
        String taxCode = req.taxCode().trim();
        if (!isValidVietnamTaxCode(taxCode)) {
            blockingErrors.add("Mã số thuế chưa chính xác. Vui lòng kiểm tra lại giấy chứng nhận thuế.");
        } else {
            String cityNorm = normalizeVietnameseName(req.city());
            String taxPrefix = taxCode.substring(0, 2);
            if ("HA NOI".equals(cityNorm) && !"01".equals(taxPrefix) && taxCode.length() == 10) {
                score += 20;
                riskFlags.add("TAX_PROVINCE_PREFIX_DIFFERS_FROM_CITY(" + taxPrefix + " vs " + req.city() + ")");
            } else if ((cityNorm.contains("HO CHI MINH") || cityNorm.contains("HCM")) && !"03".equals(taxPrefix) && taxCode.length() == 10) {
                score += 20;
                riskFlags.add("TAX_PROVINCE_PREFIX_DIFFERS_FROM_CITY(" + taxPrefix + " vs " + req.city() + ")");
            }
        }

        // 4. Legal entity name & type anti-spoofing
        String entityNorm = normalizeVietnameseName(req.legalEntityName());
        if ("ENTERPRISE".equals(req.businessType())
                && !(entityNorm.contains("CONG TY") || entityNorm.contains("TNHH")
                || entityNorm.contains("CO PHAN") || entityNorm.contains("DNTN") || entityNorm.contains("DOANH NGHIEP"))) {
            score += 25;
            riskFlags.add("ENTERPRISE_MISSING_LEGAL_FORM_KEYWORD");
        }
        if ("HOUSEHOLD_BUSINESS".equals(req.businessType())
                && (entityNorm.contains("TAP DOAN") || entityNorm.contains("CO PHAN") || entityNorm.contains("TNHH"))) {
            blockingErrors.add("Tên chủ thể kinh doanh không khớp loại hình Hộ kinh doanh.");
        }

        // 5. Phone & Business License issue date sanity
        if (!PHONE_VN_PATTERN.matcher(req.contactPhone().trim()).matches()) {
            blockingErrors.add("Số điện thoại di động Việt Nam không hợp lệ.");
        }
        if (req.businessLicenseIssuedDate().isAfter(today)
                || req.businessLicenseIssuedDate().isBefore(LocalDate.of(1990, 1, 1))) {
            blockingErrors.add("Ngày cấp giấy phép đăng ký kinh doanh không hợp lệ.");
        }

        // 6. Land-use / sublease tenure >= 180 days & PCCC safety
        if (!verifyPropertyRights(req.propertyRightType(), req.propertyExpiryDate(), today)) {
            blockingErrors.add("Hợp đồng thuê hoặc quyền sử dụng mặt bằng phải còn hiệu lực tối thiểu 180 ngày.");
        }
        if (!req.fireSafetyConfirmed() || !req.sportSafetyConfirmed() || req.pcccCertificateNumber().isBlank()) {
            blockingErrors.add("Chưa hoàn tất thông tin hồ sơ PCCC và an toàn cơ sở.");
        }

        // 7. Bank account ownership match
        if (!isBankAccountHolderConsistent(
                req.businessType(),
                req.legalEntityName(),
                req.representativeFullName(),
                req.bankAccountHolder()
        )) {
            blockingErrors.add("Tên chủ tài khoản ngân hàng phải trùng khớp với chủ thể kinh doanh hoặc người đại diện.");
        }

        boolean compliant = blockingErrors.isEmpty();
        return new InternalRiskAssessment(
                compliant,
                (short) Math.min(100, score),
                provinceName,
                riskFlags,
                blockingErrors.isEmpty() ? null : blockingErrors.get(0)
        );
    }

    public static boolean isValidVietnamTaxCode(String rawTaxCode) {
        if (rawTaxCode == null) return false;
        String trimmed = rawTaxCode.trim();
        if (!TAX_CODE_PATTERN.matcher(trimmed).matches()) {
            return false;
        }
        String base10 = trimmed.substring(0, 10);
        if (trimmed.length() == 14) {
            int branch = Integer.parseInt(trimmed.substring(11));
            if (branch < 1) return false;
        }
        int sum = 0;
        for (int i = 0; i < 9; i++) {
            sum += (base10.charAt(i) - '0') * MST_WEIGHTS[i];
        }
        int remainder = sum % 11;
        if (remainder == 0) {
            return false;
        }
        int expectedCheckDigit = 10 - remainder;
        return (base10.charAt(9) - '0') == expectedCheckDigit;
    }

    public static boolean verifyCccdConsistency(
            String cccd,
            LocalDate dob,
            String gender,
            String resolvedProvinceName
    ) {
        if (cccd == null || !cccd.matches("^\\d{12}$") || resolvedProvinceName == null || dob == null) {
            return false;
        }
        int year = dob.getYear();
        char expectedGenderCenturyDigit;
        if (year >= 1900 && year <= 1999) {
            expectedGenderCenturyDigit = "MALE".equals(gender) ? '0' : '1';
        } else if (year >= 2000 && year <= 2099) {
            expectedGenderCenturyDigit = "MALE".equals(gender) ? '2' : '3';
        } else {
            return false;
        }
        if (cccd.charAt(3) != expectedGenderCenturyDigit) {
            return false;
        }
        String expectedTwoDigitYear = String.format("%02d", year % 100);
        return cccd.substring(4, 6).equals(expectedTwoDigitYear);
    }

    public static boolean verifyPropertyRights(String propertyRightType, LocalDate expiryDate, LocalDate today) {
        if ("OWNERSHIP_CERT".equals(propertyRightType)) {
            return expiryDate == null || expiryDate.isAfter(today);
        }
        if ("LEASE_WITH_SUBLEASE".equals(propertyRightType) || "PPP_CONCESSION".equals(propertyRightType)) {
            if (expiryDate == null) return false;
            return ChronoUnit.DAYS.between(today, expiryDate) >= 180;
        }
        return false;
    }

    public static boolean isBankAccountHolderConsistent(
            String businessType,
            String legalEntityName,
            String representativeFullName,
            String bankAccountHolder
    ) {
        String bankNorm = normalizeVietnameseName(bankAccountHolder);
        String repNorm = normalizeVietnameseName(representativeFullName);
        String entityNorm = normalizeVietnameseName(legalEntityName);
        if (bankNorm.isBlank() || bankNorm.split(" ").length < 2) return false;

        if ("HOUSEHOLD_BUSINESS".equals(businessType)) {
            return bankNorm.equals(repNorm)
                    || bankNorm.equals(entityNorm)
                    || (repNorm.length() >= 4 && bankNorm.contains(repNorm));
        }
        return bankNorm.equals(entityNorm)
                || bankNorm.equals(repNorm)
                || (entityNorm.length() >= 4 && bankNorm.contains(entityNorm))
                || (bankNorm.length() >= 4 && entityNorm.contains(bankNorm));
    }

    public static String normalizeVietnameseName(String input) {
        if (input == null) return "";
        String decomposed = Normalizer.normalize(input.trim(), Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
