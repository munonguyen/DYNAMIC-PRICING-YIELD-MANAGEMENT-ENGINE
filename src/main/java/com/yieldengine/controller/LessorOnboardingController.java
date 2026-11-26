package com.yieldengine.controller;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.marketplace.*;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.service.LessorOnboardingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Lessor KYC Onboarding & Internal Review", description = "OTP eKYC challenge, 4-document upload, anti-fraud risk scoring & internal approval")
public class LessorOnboardingController {

    private final LessorOnboardingService lessorOnboardingService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "Request 6-digit OTP challenge bound to applicant phone & email (Authenticated user only)")
    @PostMapping("/lessor-applications/otp/request")
    public ResponseEntity<OtpChallengeResponse> requestOtp(@Valid @RequestBody OtpChallengeRequest request) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.status(HttpStatus.CREATED).body(lessorOnboardingService.requestOtpChallenge(request));
    }

    @Operation(summary = "Verify 6-digit OTP and issue one-time KYC verification token (Authenticated user only)")
    @PostMapping("/lessor-applications/otp/verify")
    public ResponseEntity<OtpVerifyResponse> verifyOtp(@Valid @RequestBody OtpVerifyRequest request) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(lessorOnboardingService.verifyOtpChallenge(request));
    }

    @Operation(summary = "Submit partner court-lessor KYC registration (Authenticated user only)")
    @PostMapping(value = "/lessor-applications", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LessorApplicationReceiptResponse> submitApplication(
            @Valid @RequestPart("payload") SubmitLessorApplicationRequest payload,
            @RequestPart("cccdFront") MultipartFile cccdFront,
            @RequestPart("cccdBack") MultipartFile cccdBack,
            @RequestPart("businessDoc") MultipartFile businessDoc,
            @RequestPart("courtPhoto") MultipartFile courtPhoto
    ) {
        SessionPrincipal actor = rbacGuard.requireAuthenticated();
        LessorApplicationReceiptResponse receipt = lessorOnboardingService.submitApplication(
                payload, cccdFront, cccdBack, businessDoc, courtPhoto, actor
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(receipt);
    }

    @Operation(summary = "Internal Portal: List lessor KYC applications with risk score for review (ADMIN / ACCOUNTANT only)")
    @GetMapping("/internal/lessor-applications")
    public ResponseEntity<List<LessorApplicationResponse>> listApplicationsInternal() {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(lessorOnboardingService.listAllApplicationsInternal());
    }

    @Operation(summary = "Internal Portal: Approve or reject lessor KYC application and provision Venue Tenant (ADMIN only)")
    @PostMapping("/internal/lessor-applications/{id}/review")
    public ResponseEntity<LessorApplicationResponse> reviewApplicationInternal(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewLessorApplicationRequest request
    ) {
        SessionPrincipal admin = rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.ok(lessorOnboardingService.reviewApplicationInternal(id, request, admin));
    }
}
