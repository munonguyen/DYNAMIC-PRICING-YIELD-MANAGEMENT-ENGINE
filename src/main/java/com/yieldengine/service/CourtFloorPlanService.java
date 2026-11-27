package com.yieldengine.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.entity.SlotId;
import com.yieldengine.repository.SlotInventoryRepository;
import com.yieldengine.repository.TimeSlotRepository;
import com.yieldengine.repository.UnitRepository;
import com.yieldengine.utils.DbClockUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CourtFloorPlanService {
    private static final String SELECT_FLOORS = """
            SELECT group_id, width_cm, length_cm, placements, version FROM court_floor_plans
            """;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final InventoryService inventory;
    private final TimeSlotRepository timeSlots;
    private final SlotInventoryRepository slotInventory;
    private final UnitRepository units;

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public BookingAvailability loadBookingAvailability(UUID groupId, Instant slotStart) {
        var group = inventory.getResourceGroup(groupId);
        if (!InventoryService.isPublishedForBooking(group)) throw new ResourceNotFoundException("Không tìm thấy cụm sân.");
        SlotId slotId = new SlotId(groupId, slotStart);
        var slot = timeSlots.findById(slotId).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca sân."));
        boolean available = "OPEN".equals(slot.getStatus()) && slotStart.isAfter(DbClockUtils.now(jdbc))
                && slotInventory.findById(slotId).filter(counts ->
                    counts.getHeldCount() + counts.getConfirmedCount() < counts.getTotalCapacity()).isPresent();
        var courts = units.findAvailability(groupId, slotStart, slot.getSlotEnd()).stream()
                .map(unit -> new BookingCourt(unit.getId(), unit.getUnitNumber(), bookingStatus(unit, available))).toList();
        Layout layout = currentLayout(groupId);
        if (layout != null) {
            var visibleUnits = courts.stream().map(BookingCourt::id).collect(Collectors.toSet());
            layout = new Layout(layout.groupId(), layout.widthCm(), layout.lengthCm(),
                    layout.placements().stream().filter(placement -> visibleUnits.contains(placement.unitId())).toList(), layout.version());
        }
        return new BookingAvailability(layout, courts);
    }

    private static BookingStatus bookingStatus(UnitRepository.AvailabilityRow unit, boolean available) {
        if (!"ACTIVE".equals(unit.getStatus())) return BookingStatus.UNAVAILABLE;
        if (unit.getOccupied()) return BookingStatus.TAKEN;
        return available ? BookingStatus.AVAILABLE : BookingStatus.UNAVAILABLE;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Editor load(UUID tenantId, UUID groupId) {
        requireGroup(tenantId, groupId, false);
        return new Editor(currentLayout(groupId), listUnits(tenantId, groupId));
    }

    public List<Layout> loadForVenue(UUID tenantId) {
        return jdbc.query(SELECT_FLOORS + " WHERE tenant_id = ?", this::mapLayout, tenantId);
    }

    @Transactional
    public Layout save(UUID tenantId, UUID groupId, Draft draft) {
        requireGroup(tenantId, groupId, true);
        Layout current = currentLayout(groupId);
        int revision = current == null ? 0 : current.version();
        if (draft.version() != revision) {
            throw new BusinessConflictException("Sơ đồ vừa được cập nhật. Hãy tải lại phiên bản mới trước khi lưu.");
        }
        var units = listUnits(tenantId, groupId);
        var normalized = draft.placements().stream().map(CourtPlacement::trimLabel).toList();
        validatePlacements(draft, normalized, units);
        jdbc.update("""
                INSERT INTO court_floor_plans (group_id, tenant_id, width_cm, length_cm, placements, version)
                VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?)
                ON CONFLICT (group_id) DO UPDATE SET width_cm = EXCLUDED.width_cm,
                    length_cm = EXCLUDED.length_cm, placements = EXCLUDED.placements,
                    version = EXCLUDED.version, updated_at = CURRENT_TIMESTAMP
                """, groupId, tenantId, draft.widthCm(), draft.lengthCm(), toJson(normalized), revision + 1);
        return new Layout(groupId, draft.widthCm(), draft.lengthCm(), normalized, revision + 1);
    }

    private void requireGroup(UUID tenantId, UUID groupId, boolean forUpdate) {
        List<UUID> group = jdbc.query("""
                SELECT id FROM resource_groups
                WHERE tenant_id = ? AND id = ? AND status = 'ACTIVE' AND deleted_at IS NULL
                """ + (forUpdate ? " FOR UPDATE" : ""), (row, index) -> row.getObject(1, UUID.class), tenantId, groupId);
        if (group.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy cụm sân thuộc cơ sở này.");
    }

    private Layout currentLayout(UUID groupId) {
        return jdbc.query(SELECT_FLOORS + " WHERE group_id = ?", this::mapLayout, groupId)
                .stream().findFirst().orElse(null);
    }

    private List<PhysicalCourt> listUnits(UUID tenantId, UUID groupId) {
        return jdbc.query("""
                SELECT id, unit_number FROM units
                WHERE tenant_id = ? AND group_id = ? AND status <> 'RETIRED'
                ORDER BY unit_number, id
                """, (row, index) -> new PhysicalCourt(row.getObject("id", UUID.class), row.getString("unit_number")),
                tenantId, groupId);
    }

    private static void validatePlacements(Draft draft, List<CourtPlacement> placements, List<PhysicalCourt> units) {
        var remaining = units.stream().map(PhysicalCourt::id).collect(Collectors.toCollection(HashSet::new));
        if (placements.size() != remaining.size()) {
            throw new IllegalArgumentException("Mặt bằng cần có đúng một vị trí cho mỗi sân vật lý của cụm.");
        }
        var labels = new HashSet<String>();
        for (int index = 0; index < placements.size(); index++) {
            CourtPlacement court = placements.get(index);
            if (!remaining.remove(court.unitId())) throw new IllegalArgumentException("Sân bị trùng hoặc không thuộc cụm này.");
            if (!labels.add(court.label().toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException("Tên hiển thị phải khác nhau trong cùng một cụm sân.");
            }
            if (court.right() > draft.widthCm() || court.bottom() > draft.lengthCm()) {
                throw new IllegalArgumentException("Sân " + court.label() + " nằm ngoài mặt bằng.");
            }
            for (int prior = 0; prior < index; prior++) {
                CourtPlacement other = placements.get(prior);
                if (court.xCm() < other.right() && other.xCm() < court.right()
                        && court.yCm() < other.bottom() && other.yCm() < court.bottom()) {
                    throw new IllegalArgumentException("Sân " + court.label() + " chồng lên sân " + other.label() + ".");
                }
            }
        }
    }

    private Layout mapLayout(ResultSet row, int index) throws SQLException {
        try {
            return new Layout(row.getObject("group_id", UUID.class), row.getInt("width_cm"), row.getInt("length_cm"),
                    json.readValue(row.getString("placements"), new TypeReference<List<CourtPlacement>>() {}), row.getInt("version"));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Không đọc được dữ liệu sơ đồ đã lưu.", ex);
        }
    }

    private String toJson(List<CourtPlacement> placements) {
        try {
            return json.writeValueAsString(placements);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Không mã hóa được dữ liệu sơ đồ.", ex);
        }
    }

    public record PhysicalCourt(UUID id, String unitNumber) {}
    public enum BookingStatus { AVAILABLE, TAKEN, UNAVAILABLE }
    public record BookingCourt(UUID id, String unitNumber, BookingStatus status) {}
    public record BookingAvailability(Layout layout, List<BookingCourt> courts) {}
    public record Editor(Layout layout, List<PhysicalCourt> units) {}
    public record Layout(UUID groupId, int widthCm, int lengthCm, List<CourtPlacement> placements, int version) {}
    public record Draft(
            @NotNull @Min(100) @Max(50000) Integer widthCm,
            @NotNull @Min(100) @Max(50000) Integer lengthCm,
            @NotNull @Min(0) Integer version,
            @NotNull List<@NotNull @Valid CourtPlacement> placements) {}
    public record CourtPlacement(
            @NotNull UUID unitId, @NotBlank @Size(max = 48) String label,
            @NotNull @Min(0) @Max(50000) Integer xCm,
            @NotNull @Min(0) @Max(50000) Integer yCm,
            @NotNull @Min(25) @Max(50000) Integer widthCm,
            @NotNull @Min(25) @Max(50000) Integer lengthCm) {
        int right() { return xCm + widthCm; }
        int bottom() { return yCm + lengthCm; }
        CourtPlacement trimLabel() { return new CourtPlacement(unitId, label.strip(), xCm, yCm, widthCm, lengthCm); }
    }
}
