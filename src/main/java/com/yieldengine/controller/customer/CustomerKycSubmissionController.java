package com.yieldengine.controller.customer;

import com.yieldengine.record.marketplace.*;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.RbacGuard;
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

@Tag(name = "[ROLE: USER] Partner KYC Registration", description = "OTP challenge & 4-document partner onboarding submission for players upgrading to Lessors")
@RestController
@RequestMapping("/api/v1/lessor-applications")
@RequiredArgsConstructor
public class CustomerKycSubmissionController {

    private final LessorOnboardingService lessorOnboardingService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[USER] Request 6-digit OTP challenge bound to applicant phone & email")
    @PostMapping("/otp/request")
    public ResponseEntity<OtpChallengeResponse> requestOtp(@Valid @RequestBody OtpChallengeRequest request) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.status(HttpStatus.CREATED).body(lessorOnboardingService.requestOtpChallenge(request));
    }

    @Operation(summary = "[USER] Verify 6-digit OTP and issue one-time KYC verification token")
    @PostMapping("/otp/verify")
    public ResponseEntity<OtpVerifyResponse> verifyOtp(@Valid @RequestBody OtpVerifyRequest request) {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(lessorOnboardingService.verifyOtpChallenge(request));
    }

    @Operation(summary = "[USER] Submit partner court-lessor KYC registration")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
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
}

