package com.yieldengine.controller;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.dto.analytics.SearchAndAnalyticsDtos.AnalyticsDashboardResponse;
import com.yieldengine.dto.analytics.SearchAndAnalyticsDtos.CourtSearchResponse;
import com.yieldengine.dto.analytics.SearchAndAnalyticsDtos.ReindexResponse;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.SearchAndAnalyticsSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "6. Search & Real-Time Analytics (Elasticsearch CQRS + PostgreSQL)", description = "Fast full-text search and real-time DB/Elasticsearch aggregated dashboards")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AnalyticsReadController {

    private final SearchAndAnalyticsSyncService syncService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "Fast full-text court search powered by Elasticsearch with PostgreSQL DB fallback")
    @GetMapping("/search/courts")
    public ResponseEntity<CourtSearchResponse> searchCourts(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "ALL") String sport,
            @RequestParam(required = false) UUID tenantId
    ) {
        return ResponseEntity.ok(syncService.searchCourts(q, sport, tenantId));
    }

    @Operation(summary = "Get real-time Lessor analytics dashboard from Elasticsearch CQRS / PostgreSQL")
    @GetMapping("/analytics/lessor")
    public ResponseEntity<AnalyticsDashboardResponse> getLessorAnalytics(
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(defaultValue = "7") int days
    ) {
        UUID authorizedTenant = rbacGuard.resolveAuthorizedTenantId(
                tenantId, SystemConstant.ROLE_MANAGER, SystemConstant.ROLE_STAFF
        );
        return ResponseEntity.ok(syncService.getDashboardAnalytics("LESSOR", authorizedTenant, days));
    }

    @Operation(summary = "Get platform-wide Admin & Finance analytics dashboard from Elasticsearch CQRS / PostgreSQL")
    @GetMapping("/analytics/platform")
    public ResponseEntity<AnalyticsDashboardResponse> getPlatformAnalytics(
            @RequestParam(defaultValue = "7") int days
    ) {
        rbacGuard.requirePlatformRole(SystemConstant.ROLE_ADMIN, SystemConstant.ROLE_ACCOUNTANT);
        return ResponseEntity.ok(syncService.getDashboardAnalytics("PLATFORM", null, days));
    }

    @Operation(summary = "Trigger full PostgreSQL DB -> Elasticsearch 8 CQRS synchronization")
    @PostMapping("/analytics/reindex")
    public ResponseEntity<ReindexResponse> reindexElasticsearch() {
        rbacGuard.requireAuthenticated();
        return ResponseEntity.ok(syncService.syncAllFromDatabase());
    }
}

