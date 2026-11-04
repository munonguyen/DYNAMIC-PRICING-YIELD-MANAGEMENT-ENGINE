package com.yieldengine.service;

import com.yieldengine.config.CacheConfig;
import com.yieldengine.dto.PriceQuoteResponse;
import com.yieldengine.dto.PricingAuditDto;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.entity.SlotPriceSnapshot;
import com.yieldengine.entity.TimeSlot;
import com.yieldengine.entity.YieldMatrixRule;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.repository.SlotPriceSnapshotRepository;
import com.yieldengine.repository.TimeSlotRepository;
import com.yieldengine.repository.YieldMatrixRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PricingEngineService {

    private final TimeSlotRepository timeSlotRepository;
    private final YieldMatrixRuleRepository yieldMatrixRuleRepository;
    private final SlotPriceSnapshotRepository slotPriceSnapshotRepository;
    private final PriceLockTokenService priceLockTokenService;

    /**
     * Get dynamic price quote for a slot (Read-optimized, zero database write).
     */
    @Transactional(readOnly = true)
    @Cacheable(value = CacheConfig.CACHE_SLOT_PRICES, key = "#slotId")
    public PriceQuoteResponse getPriceQuote(UUID slotId, String userId) {
        TimeSlot timeSlot = timeSlotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("TimeSlot not found with id: " + slotId));

        return computeQuote(timeSlot, userId, Instant.now());
    }

    /**
     * Internal method to calculate price and generate stateless token.
     */
    public PriceQuoteResponse computeQuote(TimeSlot timeSlot, String userId, Instant calculationTime) {
        ResourceGroup group = timeSlot.getResourceGroup();
        PricingAuditDto audit = calculatePrice(timeSlot, calculationTime);

        UUID tokenJti = UUID.randomUUID();
        Instant expiresAt = calculationTime.plus(Duration.ofMinutes(10));

        String token = priceLockTokenService.generateToken(
                tokenJti,
                userId,
                timeSlot.getId(),
                audit.getClampedPrice(),
                expiresAt
        );

        return PriceQuoteResponse.builder()
                .slotId(timeSlot.getId())
                .groupId(group.getId())
                .slotStart(timeSlot.getSlotStart())
                .slotEnd(timeSlot.getSlotEnd())
                .currentPrice(audit.getClampedPrice())
                .priceLockToken(token)
                .tokenJti(tokenJti)
                .expiresAt(expiresAt)
                .audit(audit)
                .build();
    }

    /**
     * Deterministic Mathematical Yield Formula (BigDecimal):
     * Praw = Pbase * Mtime * Mmatrix(rocc, delta_tlead) * Mcontext
     * Pfinal = min(Pmax, max(Pmin, round(Praw, -3)))
     */
    public PricingAuditDto calculatePrice(TimeSlot timeSlot, Instant calculationTime) {
        ResourceGroup group = timeSlot.getResourceGroup();
        BigDecimal basePrice = group.getBasePrice();
        BigDecimal minPrice = group.getMinPrice();
        BigDecimal maxPrice = group.getMaxPrice();

        // 1. Calculate Occupancy % (rocc)
        BigDecimal occupancyPct = calculateOccupancyPercentage(timeSlot);

        // 2. Calculate Lead Time in Hours (delta_tlead)
        BigDecimal leadHours = calculateLeadTimeHours(timeSlot.getSlotStart(), calculationTime);

        // 3. Multiplier Time-of-Day (Mtime)
        BigDecimal timeMultiplier = calculateTimeMultiplier(timeSlot.getSlotStart());

        // 4. Multiplier Context (Mcontext: weather/holiday)
        BigDecimal contextMultiplier = timeSlot.getContextMultiplier() != null
                ? timeSlot.getContextMultiplier()
                : BigDecimal.valueOf(1.000);

        // 5. Multiplier Matrix 2-D (Mmatrix)
        BigDecimal matrixMultiplier = resolveMatrixMultiplier(group.getId(), occupancyPct, leadHours);

        // 6. Compute Raw Price
        BigDecimal rawPrice = basePrice
                .multiply(timeMultiplier)
                .multiply(matrixMultiplier)
                .multiply(contextMultiplier)
                .setScale(2, RoundingMode.HALF_UP);

        // 7. Round to nearest 1,000 VND (round(Praw, -3))
        BigDecimal roundedPrice = rawPrice
                .divide(BigDecimal.valueOf(1000), 0, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(1000));

        // 8. Clamping with floor (Pmin) and ceiling (Pmax)
        BigDecimal clampedPrice = roundedPrice.max(minPrice).min(maxPrice);

        return PricingAuditDto.builder()
                .basePrice(basePrice)
                .timeMultiplier(timeMultiplier)
                .matrixMultiplier(matrixMultiplier)
                .contextMultiplier(contextMultiplier)
                .rawPrice(rawPrice)
                .clampedPrice(clampedPrice)
                .occupancyPercentage(occupancyPct)
                .leadHours(leadHours)
                .calculatedAt(calculationTime)
                .build();
    }

    /**
     * Recalculates price, updates slot_price_snapshots, and evicts/updates cache.
     */
    @Transactional
    @CachePut(value = CacheConfig.CACHE_SLOT_PRICES, key = "#timeSlot.id")
    public PriceQuoteResponse recalculateAndSnapshot(TimeSlot timeSlot) {
        PricingAuditDto audit = calculatePrice(timeSlot, Instant.now());

        SlotPriceSnapshot snapshot = slotPriceSnapshotRepository.findById(timeSlot.getId())
                .orElse(SlotPriceSnapshot.builder()
                        .timeSlot(timeSlot)
                        .slotId(timeSlot.getId())
                        .build());

        snapshot.setCurrentPrice(audit.getClampedPrice());
        snapshot.setAppliedFactors(audit.toMap());
        slotPriceSnapshotRepository.save(snapshot);

        return computeQuote(timeSlot, "SYSTEM", Instant.now());
    }

    public BigDecimal calculateOccupancyPercentage(TimeSlot timeSlot) {
        if (timeSlot.getTotalCapacity() == null || timeSlot.getTotalCapacity() == 0) {
            return BigDecimal.ZERO;
        }
        int reserved = timeSlot.getReservedCount() != null ? timeSlot.getReservedCount() : 0;
        return BigDecimal.valueOf(reserved)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(timeSlot.getTotalCapacity()), 2, RoundingMode.HALF_UP);
    }

    public BigDecimal calculateLeadTimeHours(Instant slotStart, Instant calculationTime) {
        Duration duration = Duration.between(calculationTime, slotStart);
        long seconds = Math.max(0, duration.getSeconds());
        return BigDecimal.valueOf(seconds)
                .divide(BigDecimal.valueOf(3600), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateTimeMultiplier(Instant slotStart) {
        ZonedDateTime zdt = slotStart.atZone(ZoneId.of("Asia/Ho_Chi_Minh"));
        int hour = zdt.getHour();

        // Peak hours in sports venue: 17:00 - 21:00 (multiplier 1.20)
        // Shoulder hours: 06:00 - 08:00 (multiplier 1.10)
        // Off-peak hours: 09:00 - 16:00 (multiplier 0.85)
        if (hour >= 17 && hour <= 21) {
            return BigDecimal.valueOf(1.200);
        } else if (hour >= 6 && hour <= 8) {
            return BigDecimal.valueOf(1.100);
        } else if (hour >= 9 && hour <= 16) {
            return BigDecimal.valueOf(0.850);
        }
        return BigDecimal.valueOf(1.000);
    }

    private BigDecimal resolveMatrixMultiplier(UUID groupId, BigDecimal occupancyPct, BigDecimal leadHours) {
        Optional<YieldMatrixRule> matchingRule = yieldMatrixRuleRepository.findMatchingRule(groupId, occupancyPct, leadHours);
        if (matchingRule.isPresent()) {
            return matchingRule.get().getMultiplier();
        }

        // Fallback default deterministic matrix logic if rules not found in DB
        return fallbackMatrixMultiplier(occupancyPct, leadHours);
    }

    public static BigDecimal fallbackMatrixMultiplier(BigDecimal occ, BigDecimal lead) {
        double o = occ.doubleValue();
        double h = lead.doubleValue();

        if (o < 30.0) {
            if (h >= 72.0) return BigDecimal.valueOf(0.900);
            if (h >= 12.0) return BigDecimal.valueOf(1.000);
            if (h >= 2.0)  return BigDecimal.valueOf(0.850);
            return BigDecimal.valueOf(0.700);
        } else if (o < 70.0) {
            if (h >= 72.0) return BigDecimal.valueOf(1.000);
            if (h >= 12.0) return BigDecimal.valueOf(1.050);
            if (h >= 2.0)  return BigDecimal.valueOf(1.000);
            return BigDecimal.valueOf(0.900);
        } else if (o < 90.0) {
            if (h >= 72.0) return BigDecimal.valueOf(1.150);
            if (h >= 12.0) return BigDecimal.valueOf(1.200);
            if (h >= 2.0)  return BigDecimal.valueOf(1.250);
            return BigDecimal.valueOf(1.150);
        } else {
            if (h >= 72.0) return BigDecimal.valueOf(1.300);
            if (h >= 12.0) return BigDecimal.valueOf(1.400);
            if (h >= 2.0)  return BigDecimal.valueOf(1.500);
            return BigDecimal.valueOf(1.450);
        }
    }
}
