package com.yieldengine.controller.admin;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.record.analytics.AnalyticsDashboardResponse;
import com.yieldengine.record.analytics.ReindexResponse;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.SearchAndAnalyticsSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "[ROLE: ADMIN / ACCOUNTANT] Platform Analytics & Search Sync", description = "Platform-wide GMV/commission telemetry and PostgreSQL -> Elasticsearch reindexing")
@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AdminPlatformAnalyticsController {

    private final SearchAndAnalyticsSyncService syncService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[ADMIN / ACCOUNTANT] Get platform-wide analytics from PostgreSQL")
    @GetMapping("/platform")
    public ResponseEntity<AnalyticsDashboardResponse> getPlatformAnalytics(
            @RequestParam(defaultValue = "7") int days
    ) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(syncService.getDashboardAnalytics("PLATFORM", null, days));
    }

    @Operation(summary = "[ADMIN] Trigger PostgreSQL to Elasticsearch synchronization")
    @PostMapping("/reindex")
    public ResponseEntity<ReindexResponse> reindexElasticsearch() {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN);
        return ResponseEntity.ok(syncService.syncAllFromDatabase());
    }
}

