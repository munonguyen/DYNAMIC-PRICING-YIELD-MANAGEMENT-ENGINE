package com.yieldengine.controller.lessor;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.analytics.AnalyticsDashboardResponse;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.SearchAndAnalyticsSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "[ROLE: MANAGER] Lessor Venue Analytics", description = "Venue-isolated revenue, occupancy & gateway breakdown dashboard from Elasticsearch/PostgreSQL")
@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class LessorAnalyticsController {

    private final SearchAndAnalyticsSyncService syncService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[MANAGER / STAFF] Get real-time Lessor analytics dashboard")
    @GetMapping("/lessor")
    public ResponseEntity<AnalyticsDashboardResponse> getLessorAnalytics(
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(defaultValue = "7") int days
    ) {
        UUID authorizedTenant = rbacGuard.resolveAuthorizedTenantId(
                tenantId, SystemConstant.ROLE_MANAGER, SystemConstant.ROLE_STAFF
        );
        return ResponseEntity.ok(syncService.getDashboardAnalytics("LESSOR", authorizedTenant, days));
    }
}

