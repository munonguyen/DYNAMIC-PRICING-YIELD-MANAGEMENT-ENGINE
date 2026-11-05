package com.yieldengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.PricingProperties;
import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.dto.response.HoldSlotResponse;
import com.yieldengine.dto.SlotOccupancyChangedEvent;
import com.yieldengine.entity.*;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.exception.SlotUnavailableException;
import com.yieldengine.exception.TokenAlreadyConsumedException;
import com.yieldengine.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingOrchestratorService {

    private final TimeSlotRepository timeSlotRepository;
    private final SlotInventoryRepository slotInventoryRepository;
    private final UnitRepository unitRepository;
    private final UnitTimeLockRepository unitTimeLockRepository;
    private final ReservationRepository reservationRepository;
    private final ConsumedTokenRepository consumedTokenRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final PriceLockTokenService priceLockTokenService;
    private final ApplicationEventPublisher eventPublisher;
    private final PricingProperties pricingProperties;
    private final ObjectMapper objectMapper;

    /**
     * Luồng B: Giữ chỗ & Khóa giá (Write-Contention, một @Transactional duy nhất)
     */
    @Transactional
    public HoldSlotResponse holdSlot(HoldSlotRequest request) {
        // 1. Xác thực chữ ký (theo kid) và thời hạn của token
        PriceLockTokenService.TokenPayload payload = priceLockTokenService.verifyAndExtract(request.getPriceLockToken());

        if (!payload.getGroupId().equals(request.getGroupId()) || !payload.getSlotStart().equals(request.getSlotStart())) {
            throw new IllegalArgumentException("Token target slot does not match request target");
        }

        // 2. Chống Replay Attack: kiểm tra token_jti
        if (consumedTokenRepository.existsById(payload.getTokenJti())) {
            throw new TokenAlreadyConsumedException("PriceLockToken has already been consumed: " + payload.getTokenJti());
        }

        // 3. Load TimeSlot
        SlotId slotId = new SlotId(request.getGroupId(), request.getSlotStart());
        TimeSlot timeSlot = timeSlotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("TimeSlot not found for group: " + request.getGroupId()));

        // 4. Chọn sân vật lý khả dụng với FOR UPDATE SKIP LOCKED
        Unit unit = unitRepository.findAndLockFirstAvailableUnit(request.getGroupId(), request.getSlotStart(), timeSlot.getSlotEnd())
                .orElseThrow(() -> new SlotUnavailableException("No physical court is currently available for this slot"));

        // 5. Xóa khóa HOLD đã hết hạn của sân đó (nếu có)
        unitTimeLockRepository.deleteExpiredHoldLocksForUnit(unit.getId());

        // 6. Chuẩn bị reservation ID và thời hạn giữ chỗ
        UUID reservationId = UUID.randomUUID();
        Instant now = Instant.now();
        Instant holdExpiresAt = now.plus(Duration.ofMinutes(pricingProperties.getHold().getTtlMinutes()));

        // 7. Tạo khóa vật lý unit_time_locks (GiST Exclusion chặn double-booking)
        String periodRange = String.format("[\"%s\", \"%s\")", request.getSlotStart(), timeSlot.getSlotEnd());
        UnitTimeLock lock = UnitTimeLock.builder()
                .tenantId(request.getTenantId())
                .unit(unit)
                .period(periodRange)
                .kind("HOLD")
                .reservationId(reservationId)
                .expiresAt(holdExpiresAt)
                .build();
        unitTimeLockRepository.save(lock);

        // 8. Tạo đơn đặt chỗ reservations
        Map<String, Object> pricingAudit = new HashMap<>();
        pricingAudit.put("lockedPrice", payload.getLockedPrice());
        pricingAudit.put("tokenJti", payload.getTokenJti().toString());
        pricingAudit.put("kid", payload.getKid());
        pricingAudit.put("heldAt", now.toString());

        Reservation reservation = Reservation.builder()
                .id(new ReservationId(reservationId, request.getSlotStart()))
                .tenantId(request.getTenantId())
                .groupId(request.getGroupId())
                .unit(unit)
                .status("HELD")
                .lockedPrice(payload.getLockedPrice())
                .pricingAudit(pricingAudit)
                .tokenJti(payload.getTokenJti())
                .holdExpiresAt(holdExpiresAt)
                .build();
        reservationRepository.save(reservation);

        // 9. INSERT consumed_tokens chống Replay Attack
        ConsumedToken consumedToken = ConsumedToken.builder()
                .tokenJti(payload.getTokenJti())
                .kid(payload.getKid())
                .tenantId(request.getTenantId())
                .reservationId(reservationId)
                .tokenExpires(payload.getExpiresAt())
                .build();
        consumedTokenRepository.save(consumedToken);

        // 10. UPDATE slot_inventory nguyên tử
        int updated = slotInventoryRepository.incrementHeldCountIfAvailable(request.getGroupId(), request.getSlotStart());
        if (updated == 0) {
            throw new SlotUnavailableException("Slot capacity reached during atomic inventory update");
        }

        // 11. INSERT outbox_events (SLOT_OCCUPANCY_CHANGED) cùng transaction
        Map<String, Object> outboxPayload = new HashMap<>();
        outboxPayload.put("groupId", request.getGroupId().toString());
        outboxPayload.put("slotStart", request.getSlotStart().toString());
        outboxPayload.put("reservationId", reservationId.toString());

        OutboxEvent outboxEvent = OutboxEvent.builder()
                .tenantId(request.getTenantId())
                .aggregateType("SLOT")
                .aggregateId(request.getGroupId().toString() + "#" + request.getSlotStart().toString())
                .eventType("SLOT_OCCUPANCY_CHANGED")
                .payload(outboxPayload)
                .build();
        outboxEventRepository.save(outboxEvent);

        // 12. Phát sự kiện nội bộ Spring
        eventPublisher.publishEvent(new SlotOccupancyChangedEvent(request.getGroupId(), request.getSlotStart(), now));

        log.info("Held unit {} for user {} at locked price {}", unit.getUnitNumber(), request.getUserId(), payload.getLockedPrice());

        return HoldSlotResponse.builder()
                .reservationId(reservationId)
                .unitId(unit.getId())
                .unitNumber(unit.getUnitNumber())
                .groupId(request.getGroupId())
                .slotStart(request.getSlotStart())
                .userId(request.getUserId())
                .lockedPrice(payload.getLockedPrice())
                .status("HELD")
                .holdExpiresAt(holdExpiresAt)
                .build();
    }

    @Transactional
    public void confirmReservation(UUID reservationId) {
        Reservation reservation = reservationRepository.findByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));

        if (!"HELD".equals(reservation.getStatus())) {
            throw new IllegalStateException("Reservation is not in HELD status: " + reservation.getStatus());
        }

        reservation.setStatus("CONFIRMED");
        reservation.setConfirmedAt(Instant.now());
        reservation.setHoldExpiresAt(null);
        reservationRepository.save(reservation);

        // Đổi khóa HOLD thành BOOKING
        unitTimeLockRepository.findByReservationId(reservationId).ifPresent(lock -> {
            lock.setKind("BOOKING");
            lock.setExpiresAt(null);
            unitTimeLockRepository.save(lock);
        });

        // Điều chỉnh held_count - 1, confirmed_count + 1
        slotInventoryRepository.confirmHold(reservation.getGroupId(), reservation.getSlotStart());

        log.info("Confirmed reservation: {}", reservationId);
    }

    @Transactional
    public void cancelReservation(UUID reservationId) {
        Reservation reservation = reservationRepository.findByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));

        if ("CANCELLED".equals(reservation.getStatus()) || "EXPIRED".equals(reservation.getStatus())) {
            return;
        }

        reservation.setStatus("CANCELLED");
        reservation.setCancelledAt(Instant.now());
        reservationRepository.save(reservation);

        // Xóa khóa unit_time_locks
        unitTimeLockRepository.findByReservationId(reservationId).ifPresent(unitTimeLockRepository::delete);

        // Nhả slot_inventory
        slotInventoryRepository.releaseHold(reservation.getGroupId(), reservation.getSlotStart());

        eventPublisher.publishEvent(new SlotOccupancyChangedEvent(reservation.getGroupId(), reservation.getSlotStart(), Instant.now()));
        log.info("Cancelled reservation: {}", reservationId);
    }
}
