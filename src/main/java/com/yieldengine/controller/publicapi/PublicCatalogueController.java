package com.yieldengine.controller.publicapi;

import com.yieldengine.dto.response.PriceQuoteResponse;
import com.yieldengine.entity.SportType;
import com.yieldengine.record.analytics.CourtSearchResponse;
import com.yieldengine.record.marketplace.PublishedListingResponse;
import com.yieldengine.service.InventoryService;
import com.yieldengine.service.PricingEngineService;
import com.yieldengine.service.SearchAndAnalyticsSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Tag(name = "[PUBLIC] Discovery, Search & Pricing Quote", description = "Public storefront browsing, sport catalogue, Elasticsearch full-text search & live dynamic price quote")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PublicCatalogueController {

    private final InventoryService inventoryService;
    private final SearchAndAnalyticsSyncService syncService;
    private final PricingEngineService pricingEngineService;

    @Operation(summary = "[PUBLIC] List active sport types (UC-04)")
    @GetMapping("/sport-types")
    public ResponseEntity<List<SportType>> listSportTypes() {
        return ResponseEntity.ok(inventoryService.listActiveSportTypes());
    }

    @Operation(summary = "[PUBLIC] Browse published court listings with dynamic prices & real availability (UC-11)")
    @GetMapping("/listings")
    public ResponseEntity<List<PublishedListingResponse>> browseListings(
            @RequestParam(required = false) String sport,
            @RequestParam(required = false) UUID tenant,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
    ) {
        return ResponseEntity.ok(inventoryService.browsePublishedListings(sport, tenant, from, to));
    }

    @Operation(summary = "[PUBLIC] Fast full-text court search powered by Elasticsearch with PostgreSQL fallback")
    @GetMapping("/search/courts")
    public ResponseEntity<CourtSearchResponse> searchCourts(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "ALL") String sport,
            @RequestParam(required = false) UUID tenantId
    ) {
        return ResponseEntity.ok(syncService.searchCourts(q, sport, tenantId));
    }

    @Operation(
            summary = "[PUBLIC] Get dynamic price quote & stateless PriceLockToken",
            description = "Served from Caffeine/Redis cache in < 1ms. Returns HMAC-SHA256 signed PriceLockToken."
    )
    @GetMapping("/pricing/quote")
    public ResponseEntity<PriceQuoteResponse> getPriceQuote(
            @RequestParam UUID groupId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant slotStart,
            @RequestParam(defaultValue = "user_default") String userId
    ) {
        return ResponseEntity.ok(pricingEngineService.getPriceQuote(groupId, slotStart, userId));
    }
}

