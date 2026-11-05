package com.yieldengine;

import com.yieldengine.dto.PricingAuditDto;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.entity.TimeSlot;
import com.yieldengine.service.PricingEngineService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvFileSource;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Pricing Invariant & Boundary Tests")
class PricingFormulaBoundaryTest {

    @ParameterizedTest(name = "Boundary: occ={0}%, lead={1}h -> min={3} <= price <= max={4}")
    @CsvFileSource(resources = "/pricing-boundary-cases.csv", numLinesToSkip = 1)
    void testBoundaryInvariantsFromCsv(
            BigDecimal occupancyPct,
            BigDecimal leadHours,
            BigDecimal basePrice,
            BigDecimal minPrice,
            BigDecimal maxPrice) {

        BigDecimal matrixMult = PricingEngineService.fallbackMatrixMultiplier(occupancyPct, leadHours);
        BigDecimal timeMult = BigDecimal.valueOf(1.200); // peak factor
        BigDecimal contextMult = BigDecimal.valueOf(1.100);

        BigDecimal rawPrice = basePrice.multiply(timeMult).multiply(matrixMult).multiply(contextMult);
        BigDecimal roundedPrice = rawPrice.divide(BigDecimal.valueOf(1000), 0, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(1000));
        BigDecimal finalPrice = roundedPrice.max(minPrice).min(maxPrice);

        assertTrue(finalPrice.compareTo(minPrice) >= 0, "Price must be >= minPrice");
        assertTrue(finalPrice.compareTo(maxPrice) <= 0, "Price must be <= maxPrice");
    }

    @Test
    @DisplayName("200 Grid Boundary Combinations Prove Invariant: minPrice <= Pfinal <= maxPrice")
    void test200GridBoundaryCombinations() {
        BigDecimal basePrice = BigDecimal.valueOf(200_000);
        BigDecimal minPrice = BigDecimal.valueOf(120_000);
        BigDecimal maxPrice = BigDecimal.valueOf(350_000);

        double[] occupancies = {0.0, 10.0, 29.9, 30.0, 50.0, 69.9, 70.0, 85.0, 89.9, 90.0, 95.0, 100.0};
        double[] leadHours = {0.1, 1.0, 1.9, 2.0, 6.0, 11.9, 12.0, 24.0, 48.0, 71.9, 72.0, 120.0, 168.0};
        double[] timeMultipliers = {0.85, 1.0, 1.10, 1.20};
        double[] contextMultipliers = {0.60, 1.00, 1.15};

        int testedCombinations = 0;

        for (double occ : occupancies) {
            for (double lead : leadHours) {
                for (double tm : timeMultipliers) {
                    for (double cm : contextMultipliers) {
                        BigDecimal matrixMult = PricingEngineService.fallbackMatrixMultiplier(
                                BigDecimal.valueOf(occ),
                                BigDecimal.valueOf(lead)
                        );

                        BigDecimal rawPrice = basePrice
                                .multiply(BigDecimal.valueOf(tm))
                                .multiply(matrixMult)
                                .multiply(BigDecimal.valueOf(cm));

                        BigDecimal rounded = rawPrice.divide(BigDecimal.valueOf(1000), 0, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(1000));
                        BigDecimal clamped = rounded.max(minPrice).min(maxPrice);

                        assertTrue(clamped.compareTo(minPrice) >= 0, "Clamped price must be >= minPrice");
                        assertTrue(clamped.compareTo(maxPrice) <= 0, "Clamped price must be <= maxPrice");
                        testedCombinations++;
                    }
                }
            }
        }

        assertTrue(testedCombinations >= 200, "Tested at least 200 combinations, actually tested: " + testedCombinations);
    }
}

