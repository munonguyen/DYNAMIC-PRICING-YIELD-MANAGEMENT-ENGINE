package com.yieldengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.CacheConfig;
import com.yieldengine.dto.PricingAuditDto;
import com.yieldengine.dto.response.PriceQuoteResponse;
import com.yieldengine.entity.*;
import com.yieldengine.enums.TokenPurpose;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.repository.*;
import com.yieldengine.utils.MoneyMathUtils;
import com.yieldengine.utils.TimeAndRangeUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PricingEngineService {

    private final TimeSlotRepository timeSlotRepository;
    private final SlotInventoryRepository slotInventoryRepository;
    private final ResourceGroupRepository resourceGroupRepository;
    private final YieldRuleSetRepository yieldRuleSetRepository;
    private final YieldMatrixRuleRepository yieldMatrixRuleRepository;
    private final TimeOfDayFactorRepository timeOfDayFactorRepository;
    private final ContextFactorRepository contextFactorRepository;
    private final SlotPriceCurrentRepository slotPriceCurrentRepository;
    private final TokenSigningKeyRepository tokenSigningKeyRepository;
    private final PriceLockTokenService priceLockTokenService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    @Cacheable(value = CacheConfig.CACHE_SLOT_PRICES, key = "#groupId.toString() + '_' + #slotStart.toString()")
    public PriceQuoteResponse getPriceQuote(UUID groupId, Instant slotStart, String userId) {
        SlotId slotId = new SlotId(groupId, slotStart);
        TimeSlot timeSlot = timeSlotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("TimeSlot not found for group: " + groupId + " at: " + slotStart));

        return computeQuote(timeSlot, userId, Instant.now());
    }

    public PriceQuoteResponse computeQuote(TimeSlot timeSlot, String userId, Instant calculationTime) {
        PricingAuditDto audit = calculatePrice(timeSlot, calculationTime);

        UUID tokenJti = UUID.randomUUID();
        Instant expiresAt = calculationTime.plus(Duration.ofMinutes(10));
        String kid = getActivePriceKeyId();

        String token = priceLockTokenService.generateToken(
                kid,
                tokenJti,
                timeSlot.getTenantId(),
                userId,
                timeSlot.getGroupId(),
                timeSlot.getSlotStart(),
                audit.getClampedPrice(),
                expiresAt
        );

        return PriceQuoteResponse.builder()
                .groupId(timeSlot.getGroupId())
                .slotStart(timeSlot.getSlotStart())
                .slotEnd(timeSlot.getSlotEnd())
                .currentPrice(audit.getClampedPrice())
                .priceLockToken(token)
                .tokenJti(tokenJti)
                .kid(kid)
                .expiresAt(expiresAt)
                .audit(audit)
                .build();
    }

    public PricingAuditDto calculatePrice(TimeSlot timeSlot, Instant calculationTime) {
        ResourceGroup group = resourceGroupRepository.findById(timeSlot.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found: " + timeSlot.getGroupId()));

        Long basePrice = group.getBasePrice();
        Long minPrice = group.getMinPrice();
        Long maxPrice = group.getMaxPrice();

        BigDecimal occupancyPct = calculateOccupancyPercentage(timeSlot.getGroupId(), timeSlot.getSlotStart(), timeSlot.getTotalCapacity());
        BigDecimal leadHours = calculateLeadTimeHours(timeSlot.getSlotStart(), calculationTime);

        Optional<YieldRuleSet> activeRuleSet = yieldRuleSetRepository.findActiveRuleSetForTime(group.getId(), timeSlot.getSlotStart());

        ZoneId groupZone = TimeAndRangeUtils.resolveZoneId(group.getTimezone());
        BigDecimal timeMultiplier = calculateTimeMultiplier(activeRuleSet, timeSlot.getSlotStart(), groupZone);
        BigDecimal matrixMultiplier = resolveMatrixMultiplier(activeRuleSet, occupancyPct, leadHours);
        BigDecimal contextMultiplier = resolveContextMultiplier(group.getId(), timeSlot.getSlotStart(), timeSlot.getContextMultiplier());

        BigDecimal rawPrice = BigDecimal.valueOf(basePrice)
                .multiply(timeMultiplier)
                .multiply(matrixMultiplier)
                .multiply(contextMultiplier)
                .setScale(2, RoundingMode.HALF_UP);

        long clampedPrice = MoneyMathUtils.roundAndClampPrice(rawPrice, minPrice, maxPrice);

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

    @Transactional
    @CachePut(value = CacheConfig.CACHE_SLOT_PRICES, key = "#timeSlot.groupId.toString() + '_' + #timeSlot.slotStart.toString()")
    public PriceQuoteResponse recalculateAndSnapshot(TimeSlot timeSlot) {
        Instant now = Instant.now();
        PricingAuditDto audit = calculatePrice(timeSlot, now);
        SlotId slotId = timeSlot.getId();

        Optional<YieldRuleSet> ruleSetOpt = yieldRuleSetRepository.findActiveRuleSetForTime(timeSlot.getGroupId(), timeSlot.getSlotStart());
        if (ruleSetOpt.isPresent()) {
            YieldRuleSet ruleSet = ruleSetOpt.get();
            long nextSeq = System.currentTimeMillis();
            try {
                if (!slotPriceCurrentRepository.existsById(slotId)) {
                    SlotPriceCurrent initialCurrent = SlotPriceCurrent.builder()
                            .id(slotId)
                            .tenantId(timeSlot.getTenantId())
                            .currentPrice(audit.getClampedPrice())
                            .ruleSet(ruleSet)
                            .appliedFactors(audit.toMap())
                            .priceSeq(nextSeq)
                            .computedAt(now)
                            .build();
                    slotPriceCurrentRepository.save(initialCurrent);
                } else {
                    String appliedFactorsJson = objectMapper.writeValueAsString(audit.toMap());
                    slotPriceCurrentRepository.updatePriceIfSequenceHigher(
                            timeSlot.getGroupId(),
                            timeSlot.getSlotStart(),
                            audit.getClampedPrice(),
                            ruleSet.getId(),
                            appliedFactorsJson,
                            nextSeq
                    );
                }
            } catch (Exception e) {
                log.warn("Failed to update slot_price_current: {}", e.getMessage());
            }
        }

        return computeQuote(timeSlot, "SYSTEM", now);
    }

    public BigDecimal calculateOccupancyPercentage(UUID groupId, Instant slotStart, int totalCapacity) {
        if (totalCapacity <= 0) {
            return BigDecimal.ZERO;
        }
        Optional<SlotInventory> inventoryOpt = slotInventoryRepository.findById(new SlotId(groupId, slotStart));
        int occupied = inventoryOpt.map(inv -> inv.getHeldCount() + inv.getConfirmedCount()).orElse(0);

        return BigDecimal.valueOf(occupied)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(totalCapacity), 2, RoundingMode.HALF_UP);
    }

    public BigDecimal calculateLeadTimeHours(Instant slotStart, Instant calculationTime) {
        return TimeAndRangeUtils.nonNegativeLeadHours(calculationTime, slotStart);
    }

    private BigDecimal calculateTimeMultiplier(Optional<YieldRuleSet> ruleSetOpt, Instant slotStart, ZoneId zoneId) {
        ZonedDateTime zdt = slotStart.atZone(zoneId);
        short dayOfWeek = (short) zdt.getDayOfWeek().getValue();
        short hour = (short) zdt.getHour();

        if (ruleSetOpt.isPresent()) {
            Optional<TimeOfDayFactor> factorOpt = timeOfDayFactorRepository.findMatchingFactor(ruleSetOpt.get().getId(), dayOfWeek, hour);
            if (factorOpt.isPresent()) {
                return factorOpt.get().getMultiplier();
            }
        }

        if (hour >= 17 && hour <= 21) {
            return BigDecimal.valueOf(1.2000);
        } else if (hour >= 6 && hour <= 8) {
            return BigDecimal.valueOf(1.1000);
        } else if (hour >= 9 && hour <= 16) {
            return BigDecimal.valueOf(0.8500);
        }
        return BigDecimal.valueOf(1.0000);
    }

    private BigDecimal resolveMatrixMultiplier(Optional<YieldRuleSet> ruleSetOpt, BigDecimal occupancyPct, BigDecimal leadHours) {
        if (ruleSetOpt.isPresent()) {
            Optional<YieldMatrixRule> matchingRule = yieldMatrixRuleRepository.findMatchingRule(ruleSetOpt.get().getId(), occupancyPct, leadHours);
            if (matchingRule.isPresent()) {
                return matchingRule.get().getMultiplier();
            }
        }
        return fallbackMatrixMultiplier(occupancyPct, leadHours);
    }

    private BigDecimal resolveContextMultiplier(UUID groupId, Instant slotStart, BigDecimal baseMultiplier) {
        BigDecimal mult = baseMultiplier != null ? baseMultiplier : BigDecimal.valueOf(1.0000);
        List<ContextFactor> factors = contextFactorRepository.findActiveContextFactors(groupId, slotStart);
        for (ContextFactor cf : factors) {
            mult = mult.multiply(cf.getMultiplier());
        }
        return mult;
    }

    public String getActivePriceKeyId() {
        return tokenSigningKeyRepository.findFirstByPurposeAndStatusOrderByNotBeforeDesc(TokenPurpose.PRICE_LOCK.name(), "ACTIVE")
                .map(TokenSigningKey::getKid)
                .orElse("KEY_2026_V1");
    }

    public String getActiveQrKeyId() {
        return tokenSigningKeyRepository.findFirstByPurposeAndStatusOrderByNotBeforeDesc(TokenPurpose.QR_CHECKIN.name(), "ACTIVE")
                .map(TokenSigningKey::getKid)
                .orElse("QR_KEY_2026_V1");
    }

    public static BigDecimal fallbackMatrixMultiplier(BigDecimal occ, BigDecimal lead) {
        double o = occ.doubleValue();
        double h = lead.doubleValue();

        if (o < 30.0) {
            if (h >= 72.0) return BigDecimal.valueOf(0.9000);
            if (h >= 12.0) return BigDecimal.valueOf(1.0000);
            if (h >= 2.0)  return BigDecimal.valueOf(0.8500);
            return BigDecimal.valueOf(0.7000);
        } else if (o < 70.0) {
            if (h >= 72.0) return BigDecimal.valueOf(1.0000);
            if (h >= 12.0) return BigDecimal.valueOf(1.0500);
            if (h >= 2.0)  return BigDecimal.valueOf(1.0000);
            return BigDecimal.valueOf(0.9000);
        } else if (o < 90.0) {
            if (h >= 72.0) return BigDecimal.valueOf(1.1500);
            if (h >= 12.0) return BigDecimal.valueOf(1.2000);
            if (h >= 2.0)  return BigDecimal.valueOf(1.2500);
            return BigDecimal.valueOf(1.1500);
        } else {
            if (h >= 72.0) return BigDecimal.valueOf(1.3000);
            if (h >= 12.0) return BigDecimal.valueOf(1.4000);
            if (h >= 2.0)  return BigDecimal.valueOf(1.5000);
            return BigDecimal.valueOf(1.4500);
        }
    }
}
