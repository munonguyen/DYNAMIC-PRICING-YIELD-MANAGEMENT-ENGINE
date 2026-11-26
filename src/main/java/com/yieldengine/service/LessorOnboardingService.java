package com.yieldengine.service;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.marketplace.*;
import com.yieldengine.entity.*;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.repository.*;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.validate.LessorComplianceValidator;
import com.yieldengine.record.validate.InternalRiskAssessment;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
public class LessorOnboardingService {

    private static final long MAX_DOCUMENT_BYTES = 10L * 1024L * 1024L;
    private static final int OTP_MAX_ATTEMPTS = 3;
    private static final long OTP_TTL_SECONDS = 300L;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final LessorApplicationRepository applicationRepository;
    private final LessorOtpVerificationRepository otpRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final LessorComplianceValidator complianceValidator;
    private final AuditLogService auditLogService;
    private final Path kycStorageRootDir;
    private final boolean exposeSandboxOtpHint;

    @Autowired
    public LessorOnboardingService(
            LessorApplicationRepository applicationRepository,
            LessorOtpVerificationRepository otpRepository,
            TenantRepository tenantRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            LessorComplianceValidator complianceValidator,
            AuditLogService auditLogService,
            @Value("${storage.kyc.base-dir:./data/uploads/kyc}") String kycBaseDir,
            @Value("${kyc.otp.sandbox-hint:true}") boolean exposeSandboxOtpHint
    ) {
        this.applicationRepository = applicationRepository;
        this.otpRepository = otpRepository;
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.complianceValidator = complianceValidator;
        this.auditLogService = auditLogService;
        this.kycStorageRootDir = Paths.get(kycBaseDir).toAbsolutePath().normalize();
        this.exposeSandboxOtpHint = exposeSandboxOtpHint;
    }

    @Transactional
    public OtpChallengeResponse requestOtpChallenge(OtpChallengeRequest request) {
        String cleanPhone = request.contactPhone().trim();
        String cleanEmail = request.contactEmail().trim().toLowerCase(Locale.ROOT);

        Instant fifteenMinAgo = Instant.now().minus(15, ChronoUnit.MINUTES);
        if (otpRepository.countByContactPhoneAndCreatedAtAfter(cleanPhone, fifteenMinAgo) >= 5) {
            throw new BusinessConflictException("Bạn đã yêu cầu OTP quá số lần cho phép. Vui lòng thử lại sau 15 phút.");
        }

        String rawOtp = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        LessorOtpVerification saved = otpRepository.save(LessorOtpVerification.builder()
                .contactPhone(cleanPhone)
                .contactEmail(cleanEmail)
                .otpSha256(sha256Hex(rawOtp.getBytes(StandardCharsets.UTF_8)))
                .expiresAt(Instant.now().plusSeconds(OTP_TTL_SECONDS))
                .attempts(0)
                .build());

        String maskedPhone = cleanPhone.length() >= 7
                ? cleanPhone.substring(0, 3) + "****" + cleanPhone.substring(cleanPhone.length() - 3)
                : "***";

        return new OtpChallengeResponse(
                saved.getId(),
                maskedPhone,
                OTP_TTL_SECONDS,
                exposeSandboxOtpHint ? rawOtp : null
        );
    }

    @Transactional
    public OtpVerifyResponse verifyOtpChallenge(OtpVerifyRequest request) {
        LessorOtpVerification challenge = otpRepository.findById(request.challengeId())
                .orElseThrow(() -> new ResourceNotFoundException("Phiên xác thực OTP không tồn tại."));

        if (challenge.getConsumedAt() != null) {
            throw new BusinessConflictException("Mã OTP này đã được sử dụng.");
        }
        if (Instant.now().isAfter(challenge.getExpiresAt())) {
            throw new IllegalArgumentException("Mã OTP đã hết hạn (5 phút). Vui lòng yêu cầu mã mới.");
        }
        if (challenge.getAttempts() >= OTP_MAX_ATTEMPTS) {
            throw new BusinessConflictException("Đã vượt quá số lần nhập sai OTP tối đa.");
        }

        String candidateHash = sha256Hex(request.otpCode().trim().getBytes(StandardCharsets.UTF_8));
        if (!MessageDigest.isEqual(
                candidateHash.getBytes(StandardCharsets.UTF_8),
                challenge.getOtpSha256().getBytes(StandardCharsets.UTF_8)
        )) {
            challenge.setAttempts(challenge.getAttempts() + 1);
            otpRepository.save(challenge);
            throw new IllegalArgumentException("Mã OTP không đúng.");
        }

        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();
        challenge.setVerifiedAt(now);
        challenge.setVerificationToken(token.substring(0, 48));
        otpRepository.save(challenge);

        return new OtpVerifyResponse(true, challenge.getVerificationToken(), now);
    }

    @Transactional
    public LessorApplicationReceiptResponse submitApplication(
            SubmitLessorApplicationRequest request,
            MultipartFile cccdFront,
            MultipartFile cccdBack,
            MultipartFile businessDoc,
            MultipartFile courtPhoto,
            SessionPrincipal actor
    ) {
        // 1. Verify & consume OTP ownership proof bound to exact phone + email
        LessorOtpVerification otpRecord = otpRepository
                .findByVerificationTokenAndConsumedAtIsNull(request.otpVerificationToken().trim())
                .orElseThrow(() -> new IllegalArgumentException("Chưa hoàn tất xác thực OTP SĐT/Email hợp lệ."));

        if (otpRecord.getVerifiedAt() == null || Instant.now().isAfter(otpRecord.getExpiresAt().plusSeconds(600))) {
            throw new IllegalArgumentException("Phiên xác thực OTP đã hết hạn. Vui lòng xác thực lại.");
        }
        if (!otpRecord.getContactPhone().equals(request.contactPhone().trim())
                || !otpRecord.getContactEmail().equalsIgnoreCase(request.contactEmail().trim())) {
            throw new IllegalArgumentException("SĐT hoặc Email trên hồ sơ không khớp với phiên OTP đã xác thực.");
        }

        // 2. Run strict internal statutory + anti-fraud validation
        LocalDate today = LocalDate.now();
        InternalRiskAssessment assessment = complianceValidator.evaluateStrictAndScoreRisk(request, today);
        if (!assessment.compliant()) {
            throw new IllegalArgumentException(assessment.blockingUserMessage());
        }

        String normalizedTax = request.taxCode().trim();
        String normalizedCccd = request.cccdNumber().trim();
        if (applicationRepository.existsByTaxCodeAndStatusIn(normalizedTax, List.of("PENDING_REVIEW", "APPROVED"))
                || applicationRepository.existsByCccdNumberAndStatusIn(normalizedCccd, List.of("PENDING_REVIEW", "APPROVED"))) {
            throw new BusinessConflictException("Hồ sơ định danh hoặc mã số thuế này hiện đã được đăng ký trên hệ thống.");
        }

        // 3. Require 4 genuine files + SHA-256 hash deduplication (no identical/recycled documents)
        if (cccdFront == null || cccdFront.isEmpty() || cccdBack == null || cccdBack.isEmpty()
                || businessDoc == null || businessDoc.isEmpty() || courtPhoto == null || courtPhoto.isEmpty()) {
            throw new IllegalArgumentException("Bắt buộc tải đủ CCCD mặt trước, mặt sau, ĐKKD/HĐ mặt bằng và ảnh thực tế sân.");
        }

        String appRef = "KYC-" + today.getYear() + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);
        StoredFileInfo frontStored = storeComplianceFile(appRef, "cccd-front", cccdFront, false);
        StoredFileInfo backStored = storeComplianceFile(appRef, "cccd-back", cccdBack, false);
        StoredFileInfo docStored = storeComplianceFile(appRef, "legal-doc", businessDoc, true);
        StoredFileInfo courtStored = storeComplianceFile(appRef, "court-photo", courtPhoto, false);

        Set<String> distinctHashes = new HashSet<>(List.of(
                frontStored.sha256(),
                backStored.sha256(),
                docStored.sha256(),
                courtStored.sha256()
        ));
        if (distinctHashes.size() < 4) {
            throw new IllegalArgumentException("Không được tải trùng cùng một tệp ảnh cho nhiều mục hồ sơ khác nhau.");
        }
        if (applicationRepository.existsByCccdFrontSha256OrBusinessDocSha256OrCourtPhotoSha256(
                frontStored.sha256(), docStored.sha256(), courtStored.sha256())) {
            throw new BusinessConflictException("Một hoặc nhiều tài liệu/hình ảnh đã tồn tại trong hồ sơ khác trên hệ thống.");
        }

        otpRecord.setConsumedAt(Instant.now());
        otpRepository.save(otpRecord);

        String flagsString = assessment.internalFlags().isEmpty()
                ? "CLEAN"
                : String.join("; ", assessment.internalFlags());
        String summary = "OTP Verified • RiskScore=" + assessment.riskScore()
                + " • Province=" + assessment.cccdProvinceName();

        LessorApplication saved = applicationRepository.save(LessorApplication.builder()
                .referenceCode(appRef)
                .applicantUserId(actor != null ? actor.userId() : null)
                .businessType(request.businessType())
                .legalEntityName(request.legalEntityName().trim())
                .representativeFullName(request.representativeFullName().trim())
                .representativeDob(request.representativeDob())
                .representativeGender(request.representativeGender())
                .cccdNumber(normalizedCccd)
                .cccdIssueDate(request.cccdIssueDate())
                .cccdIssuePlace(request.cccdIssuePlace().trim())
                .contactPhone(request.contactPhone().trim())
                .contactEmail(request.contactEmail().trim().toLowerCase(Locale.ROOT))
                .taxCode(normalizedTax)
                .businessLicenseNumber(request.businessLicenseNumber().trim())
                .businessLicenseIssuedDate(request.businessLicenseIssuedDate())
                .venueName(request.venueName().trim())
                .venueAddress(request.venueAddress().trim())
                .city(request.city().trim())
                .district(request.district().trim())
                .sportCodes(String.join(",", request.sportCodes()))
                .totalCourts(request.totalCourts())
                .propertyRightType(request.propertyRightType())
                .propertyDocumentNumber(request.propertyDocumentNumber().trim())
                .propertyExpiryDate(request.propertyExpiryDate())
                .pcccCertificateNumber(request.pcccCertificateNumber().trim())
                .fireSafetyConfirmed(request.fireSafetyConfirmed())
                .sportSafetyConfirmed(request.sportSafetyConfirmed())
                .cccdFrontStorageKey(frontStored.storageKey())
                .cccdBackStorageKey(backStored.storageKey())
                .businessDocStorageKey(docStored.storageKey())
                .courtPhotoStorageKey(courtStored.storageKey())
                .cccdFrontSha256(frontStored.sha256())
                .businessDocSha256(docStored.sha256())
                .courtPhotoSha256(courtStored.sha256())
                .otpVerifiedAt(otpRecord.getVerifiedAt())
                .riskScore(assessment.riskScore())
                .internalRiskFlags(flagsString)
                .bankCode(request.bankCode().trim())
                .bankAccountNumber(request.bankAccountNumber().trim())
                .bankAccountHolder(request.bankAccountHolder().trim())
                .proposedDepositPercent(request.proposedDepositPercent())
                .acceptedCommissionRate(request.acceptedCommissionRate())
                .legalCommitmentsAccepted(request.legalCommitmentsAccepted())
                .validationSummary(summary)
                .status("PENDING_REVIEW")
                .build());

        auditLogService.record(
                actor != null ? actor.userId() : null,
                actor != null ? actor.primaryRoleCode() : "APPLICANT",
                null,
                "LESSOR_KYC_SUBMITTED",
                "LESSOR_APPLICATION",
                saved.getId().toString(),
                Map.of("referenceCode", appRef, "riskScore", assessment.riskScore(), "venueName", saved.getVenueName())
        );

        log.info("Submitted hardened lessor KYC {} (riskScore={})", appRef, assessment.riskScore());
        return new LessorApplicationReceiptResponse(
                saved.getId(),
                saved.getReferenceCode(),
                saved.getVenueName(),
                saved.getLegalEntityName(),
                saved.getStatus(),
                saved.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<LessorApplicationResponse> listAllApplicationsInternal() {
        return applicationRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(LessorOnboardingService::toResponse)
                .toList();
    }

    @Transactional
    public LessorApplicationResponse reviewApplicationInternal(
            UUID applicationId,
            ReviewLessorApplicationRequest request,
            SessionPrincipal adminActor
    ) {
        LessorApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hồ sơ đối tác: " + applicationId));

        if (!"PENDING_REVIEW".equals(app.getStatus())) {
            throw new BusinessConflictException("Hồ sơ " + app.getReferenceCode() + " đã được xử lý trước đó.");
        }

        UUID provisionedTenantId = null;
        if ("APPROVED".equals(request.decision())) {
            String tenantCode = "VENUE_" + app.getReferenceCode().replace('-', '_');
            Tenant tenant = tenantRepository.save(Tenant.builder()
                    .code(tenantCode.substring(0, Math.min(tenantCode.length(), 48)))
                    .name(app.getVenueName())
                    .address(app.getVenueAddress() + ", " + app.getDistrict() + ", " + app.getCity())
                    .phone(app.getContactPhone())
                    .checkinMode("QR_STAFF")
                    .isStaffChatEnabled(true)
                    .status("ACTIVE")
                    .build());
            provisionedTenantId = tenant.getId();

            if (app.getApplicantUserId() != null) {
                User user = userRepository.findById(app.getApplicantUserId()).orElse(null);
                Role managerRole = roleRepository.findByCode(SystemConstant.ROLE_MANAGER).orElse(null);
                if (user != null && managerRole != null) {
                    userRoleRepository.save(UserRole.builder()
                            .user(user)
                            .role(managerRole)
                            .roleScope(SystemConstant.SCOPE_TENANT)
                            .tenantId(tenant.getId())
                            .grantedBy(adminActor.userId())
                            .build());
                }
            }
        }

        app.setStatus(request.decision());
        app.setReviewedBy(adminActor.userId());
        app.setReviewNote(request.reviewNote().trim());
        app.setProvisionedTenantId(provisionedTenantId);
        app.setReviewedAt(Instant.now());

        LessorApplication updated = applicationRepository.save(app);

        auditLogService.record(
                adminActor.userId(),
                adminActor.primaryRoleCode(),
                provisionedTenantId,
                "LESSOR_KYC_REVIEWED",
                "LESSOR_APPLICATION",
                app.getId().toString(),
                Map.of("decision", request.decision(), "referenceCode", app.getReferenceCode())
        );

        return toResponse(updated);
    }

    private record StoredFileInfo(String storageKey, String sha256) {
    }

    private StoredFileInfo storeComplianceFile(String appRef, String prefix, MultipartFile file, boolean allowPdf) {
        if (file.getSize() > MAX_DOCUMENT_BYTES) {
            throw new IllegalArgumentException("Tài liệu đính kèm vượt quá giới hạn 10MB.");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new IllegalArgumentException("Không thể đọc tệp đính kèm.", ex);
        }
        String ext = detectAllowedDocOrImageExtension(bytes, allowPdf);
        String hash = sha256Hex(bytes);

        String key = appRef + "/" + prefix + "-" + UUID.randomUUID() + "." + ext;
        Path dest = kycStorageRootDir.resolve(key).normalize();
        if (!dest.startsWith(kycStorageRootDir)) {
            throw new IllegalArgumentException("Đường dẫn lưu trữ hồ sơ không hợp lệ.");
        }
        try {
            Files.createDirectories(dest.getParent());
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
            }
            return new StoredFileInfo(key, hash);
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể lưu tài liệu KYC lên hệ thống lưu trữ.", ex);
        }
    }

    private static String detectAllowedDocOrImageExtension(byte[] h, boolean allowPdf) {
        int read = h.length;
        if (read >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if (read >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47) {
            return "png";
        }
        if (read >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') {
            return "webp";
        }
        if (allowPdf && read >= 4 && h[0] == '%' && h[1] == 'P' && h[2] == 'D' && h[3] == 'F') {
            return "pdf";
        }
        throw new IllegalArgumentException(
                allowPdf
                        ? "Tài liệu pháp lý chỉ chấp nhận tệp PDF, JPG, PNG hoặc WebP thực tế."
                        : "Ảnh tải lên chỉ chấp nhận tệp JPG, PNG hoặc WebP thực tế."
        );
    }

    private static String sha256Hex(byte[] data) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(data);
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    public static LessorApplicationResponse toResponse(LessorApplication app) {
        String cccd = app.getCccdNumber();
        String maskedCccd = cccd.length() == 12
                ? cccd.substring(0, 3) + "******" + cccd.substring(9)
                : "************";
        String acct = app.getBankAccountNumber();
        String maskedBank = acct.length() > 4
                ? "*".repeat(acct.length() - 4) + acct.substring(acct.length() - 4)
                : acct;
        return new LessorApplicationResponse(
                app.getId(),
                app.getReferenceCode(),
                app.getBusinessType(),
                app.getLegalEntityName(),
                app.getRepresentativeFullName(),
                maskedCccd,
                app.getTaxCode(),
                app.getBusinessLicenseNumber(),
                app.getVenueName(),
                app.getVenueAddress(),
                app.getCity(),
                app.getDistrict(),
                app.getSportCodes(),
                app.getTotalCourts(),
                app.getPropertyRightType(),
                app.getPropertyDocumentNumber(),
                app.getPropertyExpiryDate(),
                app.getPcccCertificateNumber(),
                app.getBankCode(),
                maskedBank,
                app.getBankAccountHolder(),
                app.getProposedDepositPercent(),
                app.getAcceptedCommissionRate(),
                app.getOtpVerifiedAt() != null,
                app.getRiskScore(),
                app.getInternalRiskFlags(),
                app.getValidationSummary(),
                app.getStatus(),
                app.getProvisionedTenantId(),
                app.getReviewNote(),
                app.getCreatedAt(),
                app.getReviewedAt(),
                app.getRepresentativeDob(),
                app.getRepresentativeGender(),
                app.getCccdIssueDate(),
                app.getCccdIssuePlace(),
                app.getContactPhone(),
                app.getContactEmail(),
                app.getBusinessLicenseIssuedDate(),
                app.isFireSafetyConfirmed(),
                app.isSportSafetyConfirmed(),
                app.isLegalCommitmentsAccepted(),
                app.getCccdFrontStorageKey(),
                app.getCccdBackStorageKey(),
                app.getBusinessDocStorageKey(),
                app.getCourtPhotoStorageKey()
        );
    }
}
