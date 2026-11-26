package com.yieldengine.controller.admin;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.entity.SportType;
import com.yieldengine.record.marketplace.CreateSportTypeRequest;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.InventoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "[ROLE: ADMIN] Platform Sport Catalogue", description = "Create and govern marketplace-wide sport categories")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AdminCatalogueGovernanceController {

    private final InventoryService inventoryService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[ADMIN] Create new sport type (UC-04)")
    @PostMapping("/sport-types")
    public ResponseEntity<SportType> createSportType(@Valid @RequestBody CreateSportTypeRequest request) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.createSportType(request));
    }
}

