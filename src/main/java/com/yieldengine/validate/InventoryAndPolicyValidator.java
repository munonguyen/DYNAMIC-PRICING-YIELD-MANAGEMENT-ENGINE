package com.yieldengine.validate;

import com.yieldengine.dto.marketplace.MarketplaceDtos.PolicyTierDto;
import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.dto.request.ResourceGroupRequest;
import com.yieldengine.entity.CancellationPolicy;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.repository.SportTypeRepository;
import com.yieldengine.repository.UnitRepository;
import com.yieldengine.repository.YieldRuleSetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Validator for Catalogue, Court Groups, Publishing pre-conditions, and Cancellation Policies (UC-04..10).
 */
@Component
@RequiredArgsConstructor
public class InventoryAndPolicyValidator {

    private final SportTypeRepository sportTypeRepository;
    private final UnitRepository unitRepository;
    private final YieldRuleSetRepository yieldRuleSetRepository;

    public void validateUniqueSportCode(String normalizedCode) {
        if (sportTypeRepository.findByCode(normalizedCode).isPresent()) {
            throw new BusinessConflictException("Sport type code already exists: " + normalizedCode);
        }
    }

    public void validatePolicyTiers(List<PolicyTierDto> tiers) {
        if (tiers == null || tiers.isEmpty()) {
            throw new IllegalArgumentException("At least one cancellation policy tier is required");
        }
        Set<Integer> seenHours = new HashSet<>();
        for (PolicyTierDto tier : tiers) {
            if (tier.minHoursBefore() < 0) {
                throw new IllegalArgumentException("minHoursBefore must be non-negative");
            }
            if (tier.refundPercent() < 0 || tier.refundPercent() > 100) {
                throw new IllegalArgumentException("refundPercent must be between 0 and 100");
            }
            if (!seenHours.add(tier.minHoursBefore())) {
                throw new IllegalArgumentException("Duplicate minHoursBefore tier: " + tier.minHoursBefore());
            }
        }
    }

    public void validateResourceGroupRequest(ResourceGroupRequest request, CancellationPolicy resolvedPolicy) {
        if (request.getMinPrice() > request.getBasePrice() || request.getBasePrice() > request.getMaxPrice()) {
            throw new IllegalArgumentException("Price bounds invariant violated: minPrice <= basePrice <= maxPrice");
        }
        short depositPct = request.getDepositPercent() != null ? request.getDepositPercent() : 0;
        if (depositPct < 0 || depositPct > 100) {
            throw new IllegalArgumentException("depositPercent must be between 0 and 100");
        }
        if (depositPct > 0 && resolvedPolicy == null) {
            throw new IllegalArgumentException("cancellationPolicyId is required when depositPercent > 0");
        }
    }

    public void validateTimeSlotRequest(CreateTimeSlotRequest request) {
        if (!request.getSlotEnd().isAfter(request.getSlotStart())) {
            throw new IllegalArgumentException("slotEnd must be strictly after slotStart");
        }
    }

    public void validateGroupPublishable(UUID groupId, Instant checkTime) {
        long activeCourts = unitRepository.findByResourceGroupId(groupId).stream()
                .filter(u -> "ACTIVE".equals(u.getStatus()))
                .count();
        if (activeCourts == 0) {
            throw new BusinessConflictException("Cannot publish court group without at least one ACTIVE court");
        }
        if (yieldRuleSetRepository.findActiveRuleSetForTime(groupId, checkTime).isEmpty()) {
            throw new BusinessConflictException("Cannot publish court group without an ACTIVE pricing rule set");
        }
    }
}

