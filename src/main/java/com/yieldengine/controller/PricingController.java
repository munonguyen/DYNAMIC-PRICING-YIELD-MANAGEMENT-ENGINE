package com.yieldengine.controller;

import com.yieldengine.dto.PriceQuoteResponse;
import com.yieldengine.service.PricingEngineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "2. Dynamic Pricing Engine", description = "Endpoints for viewing real-time dynamic prices and issuing stateless PriceLockTokens")
@RestController
@RequestMapping("/api/v1/pricing")
@RequiredArgsConstructor
public class PricingController {

    private final PricingEngineService pricingEngineService;

    @Operation(
            summary = "Get dynamic price quote & stateless PriceLockToken",
            description = "Read-heavy endpoint served from Caffeine/Redis cache in < 1ms. Zero DB writes. Returns HMAC-SHA256 signed PriceLockToken valid for 10 minutes."
    )
    @GetMapping("/quote")
    public ResponseEntity<PriceQuoteResponse> getPriceQuote(
            @RequestParam UUID slotId,
            @RequestParam(defaultValue = "user_default") String userId) {
        PriceQuoteResponse quote = pricingEngineService.getPriceQuote(slotId, userId);
        return ResponseEntity.ok(quote);
    }
}
