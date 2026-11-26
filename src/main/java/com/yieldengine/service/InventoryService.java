package com.yieldengine.service;

import com.yieldengine.record.marketplace.*;
import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.dto.request.ResourceGroupRequest;
import com.yieldengine.entity.*;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.mapper.InventoryMapper;
import com.yieldengine.repository.*;
import com.yieldengine.utils.CommonTextAndPageUtils;
import com.yieldengine.security.AuthContext;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import java.sql.Timestamp;
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
    private final YieldRuleSetRepository yieldRuleSetRepository;
    private final NamedParameterJdbcTemplate catalogueJdbc;
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
                .filter(sport -> "ACTIVE".equals(sport.getStatus()))
                .orElseThrow(() -> new ResourceNotFoundException("Môn thể thao không tồn tại hoặc đã ngừng hoạt động."));

        CancellationPolicy policy = null;
        if (request.getCancellationPolicyId() != null) {
            policy = cancellationPolicyRepository.findByIdAndTenantId(request.getCancellationPolicyId(), tenant.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("CancellationPolicy not found for venue"));
        }

        inventoryValidator.validateResourceGroupRequest(request, policy);

        ResourceGroup group = inventoryMapper.toResourceGroup(request, tenant, sportType, policy);
        group = resourceGroupRepository.save(group);

        yieldRuleSetRepository.save(YieldRuleSet.builder()
                .resourceGroup(group)
                .tenantId(tenant.getId())
                .versionNo(1)
                .status("ACTIVE")
                .effective("(,)")
                .build());

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

        if (!endRange.isAfter(startRange) || Duration.between(startRange, endRange).compareTo(Duration.ofDays(31)) > 0) {
            throw new IllegalArgumentException("Khoảng xem lịch phải hợp lệ và không quá 31 ngày.");
        }
        return assembleListings(resourceGroupRepository.findPublishedListings(normalizedSport, tenantId), startRange, endRange);
    }

    @Transactional(readOnly = true)
    public List<PublishedListingResponse> listManagedGroups(UUID tenantId) {
        Instant now = Instant.now();
        var groups = resourceGroupRepository.findByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .filter(group -> group.getDeletedAt() == null).toList();
        return assembleListings(groups, now, now.plus(Duration.ofDays(7)));
    }

    @Transactional
    public ResourceGroup updateGroup(UUID groupId, UpdateCourtGroupRequest request) {
        ResourceGroup group = getResourceGroup(groupId);
        long min = request.minPrice() != null ? request.minPrice() : group.getMinPrice();
        long base = request.basePrice() != null ? request.basePrice() : group.getBasePrice();
        long max = request.maxPrice() != null ? request.maxPrice() : group.getMaxPrice();
        if (min > base || base > max) {
            throw new IllegalArgumentException("Giá phải thỏa min ≤ giá cơ sở ≤ max.");
        }
        if (request.depositPercent() != null && request.depositPercent() > 0 && group.getCancellationPolicy() == null) {
            throw new IllegalArgumentException("Cần chính sách hủy trước khi yêu cầu đặt cọc.");
        }
        boolean changedPrice = min != group.getMinPrice() || base != group.getBasePrice() || max != group.getMaxPrice();
        group.setMinPrice(min);
        group.setBasePrice(base);
        group.setMaxPrice(max);
        if (request.depositPercent() != null) group.setDepositPercent(request.depositPercent());
        if (request.checkinMode() != null) group.setCheckinMode(request.checkinMode());
        if (request.addOnServices() != null) {
            if (request.addOnServices().stream().map(CourtAddOn::id).distinct().count() != request.addOnServices().size()) {
                throw new IllegalArgumentException("Mã dịch vụ không được trùng.");
            }
            group.setAddOnServices(new ArrayList<>(request.addOnServices()));
        }
        if (changedPrice) {
            catalogueJdbc.update("DELETE FROM slot_price_current WHERE group_id = :id AND slot_start >= now()", Map.of("id", groupId));
        }
        return resourceGroupRepository.save(group);
    }

    private List<PublishedListingResponse> assembleListings(List<ResourceGroup> groups, Instant from, Instant to) {
        if (groups.isEmpty()) return List.of();
        var groupIds = groups.stream().map(ResourceGroup::getId).toList();
        var media = courtMediaStorageService.listMediaGroupedByGroupIds(groupIds);
        Map<UUID, List<SlotListingQuoteDto>> slots = new HashMap<>();
        catalogueJdbc.query("""
                SELECT ts.group_id, ts.slot_start, ts.slot_end, ts.total_capacity,
                       GREATEST(0, ts.total_capacity - COALESCE(si.held_count + si.confirmed_count, 0)) AS available,
                       COALESCE(sp.current_price, rg.base_price) AS price
                FROM time_slots ts
                JOIN resource_groups rg ON rg.id = ts.group_id
                LEFT JOIN slot_inventory si ON si.group_id = ts.group_id AND si.slot_start = ts.slot_start
                LEFT JOIN slot_price_current sp ON sp.group_id = ts.group_id AND sp.slot_start = ts.slot_start
                WHERE ts.group_id IN (:groups) AND ts.slot_start >= :from AND ts.slot_start < :to AND ts.status = 'OPEN'
                ORDER BY ts.slot_start
                """, Map.of("groups", groupIds, "from", Timestamp.from(from), "to", Timestamp.from(to)), row -> {
            UUID groupId = row.getObject("group_id", UUID.class);
            slots.computeIfAbsent(groupId, id -> new ArrayList<>()).add(new SlotListingQuoteDto(
                    row.getTimestamp("slot_start").toInstant(), row.getTimestamp("slot_end").toInstant(),
                    row.getInt("total_capacity"), row.getInt("available"), row.getLong("price")));
        });
        return groups.stream().map(group -> {
            var gallery = media.getOrDefault(group.getId(), List.of());
            var cover = gallery.stream().findFirst().map(CourtMediaDto::url).orElse(null);
            return new PublishedListingResponse(group.getId(), group.getCode(), group.getName(),
                    group.getTenant().getId(), group.getTenant().getName(), group.getTenant().getAddress(),
                    group.getSportType().getCode(), group.getSportType().getName(), group.getBasePrice(),
                    group.getMinPrice(), group.getMaxPrice(), group.getDepositPercent(), group.getSlotMinutes(),
                    group.resolveEffectiveCheckinMode(), cover, gallery, slots.getOrDefault(group.getId(), List.of()),
                    "PUBLISHED".equals(group.getPublishStatus()), group.getAddOnServices(),
                    Boolean.TRUE.equals(group.getTenant().getIsStaffChatEnabled()));
        }).toList();
    }

    @Transactional(readOnly = true)
    public ResourceGroup getResourceGroup(UUID id) {
        return resourceGroupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found: " + id));
    }

    @Transactional(readOnly = true)
    public ResourceGroup getVisibleResourceGroup(UUID id) {
        ResourceGroup group = getResourceGroup(id);
        boolean visible = "PUBLISHED".equals(group.getPublishStatus()) && "ACTIVE".equals(group.getStatus())
                && group.getDeletedAt() == null && "ACTIVE".equals(group.getTenant().getStatus());
        if (visible || AuthContext.current().filter(actor -> actor.hasPlatformRole("ADMIN")
                || actor.hasTenantRole(group.getTenant().getId(), "MANAGER", "STAFF")).isPresent()) {
            return group;
        }
        throw new ResourceNotFoundException("Không tìm thấy cụm sân.");
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
        if (!end.isAfter(start) || Duration.between(start, end).compareTo(Duration.ofDays(31)) > 0) {
            throw new IllegalArgumentException("Khoảng thời gian phải hợp lệ và không quá 31 ngày.");
        }
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

}
