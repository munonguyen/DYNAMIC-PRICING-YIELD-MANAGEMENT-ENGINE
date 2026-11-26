package com.yieldengine.controller.admin;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.marketplace.LessorApplicationResponse;
import com.yieldengine.record.marketplace.ReviewLessorApplicationRequest;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.LessorOnboardingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "[ROLE: ADMIN / ACCOUNTANT] Partner KYC Review", description = "Inspect risk scores, Modulo-11 tax codes & approve/reject partner lessor applications")
@RestController
@RequestMapping("/api/v1/internal/lessor-applications")
@RequiredArgsConstructor
public class AdminKycReviewController {

    private final LessorOnboardingService lessorOnboardingService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[ADMIN / ACCOUNTANT] List lessor KYC applications with risk score")
    @GetMapping
    public ResponseEntity<List<LessorApplicationResponse>> listApplicationsInternal() {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(lessorOnboardingService.listAllApplicationsInternal());
    }

    @Operation(summary = "[ADMIN] Approve or reject lessor KYC application and provision Venue Tenant")
    @PostMapping("/{id}/review")
    public ResponseEntity<LessorApplicationResponse> reviewApplicationInternal(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewLessorApplicationRequest request
    ) {
        SessionPrincipal admin = rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.ok(lessorOnboardingService.reviewApplicationInternal(id, request, admin));
    }
}

