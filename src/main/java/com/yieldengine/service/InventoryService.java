package com.yieldengine.service;

import com.yieldengine.dto.marketplace.MarketplaceDtos.*;
import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.dto.request.ResourceGroupRequest;
import com.yieldengine.entity.*;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.mapper.InventoryMapper;
import com.yieldengine.repository.*;
import com.yieldengine.utils.CommonTextAndPageUtils;
import com.yieldengine.validate.AuthAndRbacValidator;
import com.yieldengine.validate.InventoryAndPolicyValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final TenantRepository tenantRepository;
    private final SportTypeRepository sportTypeRepository;
    private final CancellationPolicyRepository cancellationPolicyRepository;
    private final ResourceGroupRepository resourceGroupRepository;
    private final UnitRepository unitRepository;
    private final TimeSlotRepository timeSlotRepository;
    private final SlotInventoryRepository slotInventoryRepository;
    private final SlotPriceCurrentRepository slotPriceCurrentRepository;
    private final PricingEngineService pricingEngineService;
    private final AuditLogService auditLogService;
    private final InventoryMapper inventoryMapper;
    private final InventoryAndPolicyValidator inventoryValidator;
    private final AuthAndRbacValidator authValidator;
    private final CourtMediaStorageService courtMediaStorageService;

    @Transactional
    public SportType createSportType(CreateSportTypeRequest request) {
        String normalizedCode = CommonTextAndPageUtils.normalizeUpperCode(request.code());
        inventoryValidator.validateUniqueSportCode(normalizedCode);

        SportType sport = SportType.builder()
                .code(normalizedCode)
                .name(request.name().trim())
                .status("ACTIVE")
                .build();
        return sportTypeRepository.save(sport);
    }

    @Transactional(readOnly = true)
    public List<SportType> listActiveSportTypes() {
        return sportTypeRepository.findByStatusOrderByNameAsc("ACTIVE");
    }

    @Transactional
    public Tenant updateVenueSettings(UUID tenantId, UpdateVenueSettingsRequest request) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Venue not found: " + tenantId));

        if (request.name() != null && !request.name().isBlank()) {
            tenant.setName(request.name().trim());
        }
        if (request.address() != null) {
            tenant.setAddress(request.address().trim());
        }
        if (request.phone() != null) {
            tenant.setPhone(request.phone().trim());
        }
        if (request.latitude() != null && request.longitude() != null) {
            tenant.setLatitude(request.latitude());
            tenant.setLongitude(request.longitude());
        }
        if (request.checkinMode() != null) {
            tenant.setCheckinMode(request.checkinMode());
        }
        if (request.isStaffChatEnabled() != null) {
            tenant.setIsStaffChatEnabled(request.isStaffChatEnabled());
        }

        tenant = tenantRepository.save(tenant);
        auditLogService.record(
                null,
                null,
                tenantId,
                "VENUE_SETTINGS_UPDATED",
                "TENANT",
                tenantId.toString(),
                Map.of("checkinMode", tenant.getCheckinMode(), "staffChatEnabled", tenant.getIsStaffChatEnabled())
        );
        return tenant;
    }

    @Transactional
    public CancellationPolicy createCancellationPolicy(UUID tenantId, CreateCancellationPolicyRequest request) {
        authValidator.validateVenueExists(tenantId);
        inventoryValidator.validatePolicyTiers(request.tiers());

        CancellationPolicy persistedPolicy = cancellationPolicyRepository.saveAndFlush(CancellationPolicy.builder()
                .tenantId(tenantId)
                .name(request.name().trim())
                .status("ACTIVE")
                .build());

        UUID policyId = persistedPolicy.getId();
        List<CancellationPolicyTier> tierEntities = request.tiers().stream()
                .map(tierDto -> CancellationPolicyTier.builder()
                        .id(new CancellationPolicyTierId(policyId, tierDto.minHoursBefore()))
                        .policy(persistedPolicy)
                        .refundPercent(tierDto.refundPercent())
                        .build())
                .toList();

        persistedPolicy.getTiers().addAll(tierEntities);
        CancellationPolicy savedPolicy = cancellationPolicyRepository.save(persistedPolicy);

        auditLogService.record(
                null,
                null,
                tenantId,
                "CANCELLATION_POLICY_CREATED",
                "CANCELLATION_POLICY",
                savedPolicy.getId().toString(),
                Map.of("name", savedPolicy.getName(), "tiersCount", tierEntities.size())
        );
        return savedPolicy;
    }

    @Transactional(readOnly = true)
    public List<CancellationPolicy> listCancellationPolicies(UUID tenantId) {
        return cancellationPolicyRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    @Transactional
    public ResourceGroup createResourceGroup(ResourceGroupRequest request) {
        Tenant tenant = resolveOrDefaultTenant(request.getTenantId());

        String sportCode = CommonTextAndPageUtils.normalizeOptionalUpperCode(request.getSportCode());
        final String effectiveSportCode = sportCode != null ? sportCode : "PICKLEBALL";
        SportType sportType = sportTypeRepository.findByCode(effectiveSportCode)
                .orElseGet(() -> sportTypeRepository.save(SportType.builder()
                        .code(effectiveSportCode)
                        .name(effectiveSportCode)
                        .status("ACTIVE")
                        .build()));

        CancellationPolicy policy = null;
        if (request.getCancellationPolicyId() != null) {
            policy = cancellationPolicyRepository.findByIdAndTenantId(request.getCancellationPolicyId(), tenant.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("CancellationPolicy not found for venue"));
        }

        inventoryValidator.validateResourceGroupRequest(request, policy);

        ResourceGroup group = inventoryMapper.toResourceGroup(request, tenant, sportType, policy);
        group = resourceGroupRepository.save(group);

        List<Unit> units = new ArrayList<>();
        for (int i = 1; i <= request.getTotalUnits(); i++) {
            units.add(Unit.builder()
                    .tenantId(tenant.getId())
                    .resourceGroup(group)
                    .unitNumber(String.format("SAN_%02d", i))
                    .status("ACTIVE")
                    .build());
        }
        unitRepository.saveAll(units);

        log.info("Created ResourceGroup {} ({}) with {} units for venue {}",
                group.getCode(), sportType.getCode(), request.getTotalUnits(), tenant.getCode());
        return group;
    }

    @Transactional
    public ResourceGroup updatePublishStatus(UUID groupId, boolean publish) {
        ResourceGroup group = getResourceGroup(groupId);
        if (publish) {
            inventoryValidator.validateGroupPublishable(groupId, Instant.now());
            group.setPublishStatus("PUBLISHED");
        } else {
            group.setPublishStatus("UNPUBLISHED");
        }

        group = resourceGroupRepository.save(group);
        auditLogService.record(
                null,
                null,
                group.getTenant().getId(),
                "GROUP_PUBLISH_CHANGED",
                "RESOURCE_GROUP",
                groupId.toString(),
                Map.of("publishStatus", group.getPublishStatus())
        );
        return group;
    }

    @Transactional(readOnly = true)
    public List<PublishedListingResponse> browsePublishedListings(String sportCode, UUID tenantId, Instant from, Instant to) {
        String normalizedSport = CommonTextAndPageUtils.normalizeOptionalUpperCode(sportCode);
        Instant startRange = from != null ? from : Instant.now();
        Instant endRange = to != null ? to : startRange.plus(Duration.ofDays(2));

        List<ResourceGroup> groups = resourceGroupRepository.findPublishedListings(normalizedSport, tenantId);
        List<UUID> groupIds = groups.stream().map(ResourceGroup::getId).toList();
        Map<UUID, List<CourtMediaDto>> mediaByGroup = courtMediaStorageService.listMediaGroupedByGroupIds(groupIds);
        List<PublishedListingResponse> responses = new ArrayList<>();

        for (ResourceGroup group : groups) {
            List<SlotListingQuoteDto> slotDtos = timeSlotRepository
                    .findSlotsInRange(group.getId(), startRange, endRange)
                    .stream()
                    .filter(s -> "OPEN".equals(s.getStatus()))
                    .map(slot -> toSlotListingQuote(group, slot))
                    .toList();

            List<CourtMediaDto> gallery = mediaByGroup.getOrDefault(group.getId(), List.of());
            String coverUrl = gallery.stream().findFirst().map(CourtMediaDto::url).orElse(null);

            responses.add(new PublishedListingResponse(
                    group.getId(),
                    group.getCode(),
                    group.getName(),
                    group.getTenant().getId(),
                    group.getTenant().getName(),
                    group.getTenant().getAddress(),
                    group.getSportType().getCode(),
                    group.getSportType().getName(),
                    group.getBasePrice(),
                    group.getMinPrice(),
                    group.getMaxPrice(),
                    group.getDepositPercent(),
                    group.getSlotMinutes(),
                    group.getCheckinMode() != null ? group.getCheckinMode() : group.getTenant().getCheckinMode(),
                    coverUrl,
                    gallery,
                    slotDtos
            ));
        }
        return responses;
    }

    @Transactional(readOnly = true)
    public ResourceGroup getResourceGroup(UUID id) {
        return resourceGroupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found: " + id));
    }

    @Transactional
    public TimeSlot createTimeSlot(CreateTimeSlotRequest request) {
        inventoryValidator.validateTimeSlotRequest(request);
        ResourceGroup group = getResourceGroup(request.getGroupId());

        int capacity = (request.getTotalCapacity() != null && request.getTotalCapacity() > 0)
                ? request.getTotalCapacity()
                : (int) unitRepository.findByResourceGroupId(group.getId()).stream()
                        .filter(u -> "ACTIVE".equals(u.getStatus()))
                        .count();
        if (capacity <= 0) {
            capacity = 10;
        }

        TimeSlot timeSlot = inventoryMapper.toTimeSlot(request, group, capacity);
        timeSlot = timeSlotRepository.save(timeSlot);

        SlotInventory inventory = inventoryMapper.toSlotInventory(request, group, capacity);
        slotInventoryRepository.save(inventory);

        pricingEngineService.recalculateAndSnapshot(timeSlot);
        return timeSlot;
    }

    @Transactional(readOnly = true)
    public List<TimeSlot> getSlots(UUID groupId, Instant start, Instant end) {
        return timeSlotRepository.findSlotsInRange(groupId, start, end);
    }

    private Tenant resolveOrDefaultTenant(UUID tenantId) {
        if (tenantId != null) {
            return tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Tenant not found: " + tenantId));
        }
        return tenantRepository.findAll().stream().findFirst()
                .orElseGet(() -> tenantRepository.save(Tenant.builder()
                        .code("DEFAULT_TENANT")
                        .name("Default System Tenant")
                        .status("ACTIVE")
                        .build()));
    }

    private SlotListingQuoteDto toSlotListingQuote(ResourceGroup group, TimeSlot slot) {
        SlotId sid = slot.getId();
        int occupied = slotInventoryRepository.findById(sid)
                .map(inv -> inv.getHeldCount() + inv.getConfirmedCount())
                .orElse(0);
        int available = Math.max(0, slot.getTotalCapacity() - occupied);

        Long dynamicPrice;
        try {
            dynamicPrice = pricingEngineService
                    .getPriceQuote(group.getId(), slot.getSlotStart(), "ANONYMOUS")
                    .getCurrentPrice();
        } catch (Exception ex) {
            dynamicPrice = slotPriceCurrentRepository.findById(sid)
                    .map(SlotPriceCurrent::getCurrentPrice)
                    .orElse(group.getBasePrice());
        }
        return new SlotListingQuoteDto(
                slot.getSlotStart(),
                slot.getSlotEnd(),
                slot.getTotalCapacity(),
                available,
                dynamicPrice
        );
    }
}
