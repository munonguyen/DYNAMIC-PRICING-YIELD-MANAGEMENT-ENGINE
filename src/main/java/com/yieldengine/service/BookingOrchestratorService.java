package com.yieldengine.service;

import com.yieldengine.config.PricingProperties;
import com.yieldengine.dto.HoldSlotRequest;
import com.yieldengine.dto.HoldSlotResponse;
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
    private final UnitRepository unitRepository;
    private final ReservationRepository reservationRepository;
    private final ConsumedTokenRepository consumedTokenRepository;
    private final PriceLockTokenService priceLockTokenService;
    private final ApplicationEventPublisher eventPublisher;
    private final PricingProperties pricingProperties;

    /**
     * ACID Hold Slot transaction:
     * 1. Verify PriceLockToken (HMAC-SHA256 signature, expiry, matching slot/user).
     * 2. Check token replay in consumed_tokens (Anti-Replay).
     * 3. Check capacity on TimeSlot (@Version Optimistic Locking).
     * 4. Lock physical unit via UnitRepository.findAndLockFirstAvailableUnit (FOR UPDATE SKIP LOCKED).
     * 5. Increment reserved_count, save Reservation (status = HELD), insert into consumed_tokens.
     * 6. Publish SlotOccupancyChangedEvent for AFTER_COMMIT asynchronous recalculation.
     */
    @Transactional
    public HoldSlotResponse holdSlot(HoldSlotRequest request) {
        // 1. Verify token signature and expiration
        PriceLockTokenService.TokenPayload payload = priceLockTokenService.verifyAndExtract(request.getPriceLockToken());

        if (!payload.getSlotId().equals(request.getSlotId())) {
            throw new IllegalArgumentException("Token slotId does not match request slotId");
        }

        // 2. Anti-Replay check: has token already been consumed?
        if (consumedTokenRepository.existsById(payload.getTokenJti())) {
            throw new TokenAlreadyConsumedException("PriceLockToken has already been consumed: " + payload.getTokenJti());
        }

        // 3. Load TimeSlot and check capacity
        TimeSlot timeSlot = timeSlotRepository.findById(request.getSlotId())
                .orElseThrow(() -> new ResourceNotFoundException("TimeSlot not found with id: " + request.getSlotId()));

        if (timeSlot.getReservedCount() >= timeSlot.getTotalCapacity()) {
            throw new SlotUnavailableException("No remaining capacity for time slot: " + timeSlot.getId());
        }

        // 4. Find and lock first available physical unit
        Unit unit = unitRepository.findAndLockFirstAvailableUnit(timeSlot.getResourceGroup().getId(), timeSlot.getId())
                .orElseThrow(() -> new SlotUnavailableException("All physical units are currently held or booked"));

        // 5. Build and save Reservation
        Instant now = Instant.now();
        Instant holdExpiresAt = now.plus(Duration.ofMinutes(pricingProperties.getHold().getTtlMinutes()));

        Map<String, Object> pricingAudit = new HashMap<>();
        pricingAudit.put("lockedPrice", payload.getLockedPrice());
        pricingAudit.put("tokenJti", payload.getTokenJti());
        pricingAudit.put("verifiedAt", now.toString());

        Reservation reservation = Reservation.builder()
                .unit(unit)
                .timeSlot(timeSlot)
                .resourceGroup(timeSlot.getResourceGroup())
                .userId(request.getUserId())
                .lockedPrice(payload.getLockedPrice())
                .pricingAudit(pricingAudit)
                .status(ReservationStatus.HELD)
                .holdExpiresAt(holdExpiresAt)
                .build();

        reservation = reservationRepository.save(reservation);

        // 6. Record consumed token to prevent replay
        ConsumedToken consumedToken = ConsumedToken.builder()
                .tokenJti(payload.getTokenJti())
                .reservation(reservation)
                .build();
        consumedTokenRepository.save(consumedToken);

        // 7. Update reservedCount on TimeSlot (triggers @Version check)
        timeSlot.setReservedCount(timeSlot.getReservedCount() + 1);
        timeSlotRepository.save(timeSlot);

        // 8. Publish internal Spring Event (handled AFTER_COMMIT via @Async)
        eventPublisher.publishEvent(new SlotOccupancyChangedEvent(timeSlot.getId(), timeSlot.getResourceGroup().getId(), now));

        log.info("Held unit {} for user {} at locked price {}", unit.getUnitNumber(), request.getUserId(), payload.getLockedPrice());

        return HoldSlotResponse.builder()
                .reservationId(reservation.getId())
                .unitId(unit.getId())
                .unitNumber(unit.getUnitNumber())
                .slotId(timeSlot.getId())
                .userId(request.getUserId())
                .lockedPrice(payload.getLockedPrice())
                .status(reservation.getStatus().name())
                .holdExpiresAt(holdExpiresAt)
                .build();
    }

    @Transactional
    public void confirmReservation(UUID reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));

        if (reservation.getStatus() != ReservationStatus.HELD) {
            throw new IllegalStateException("Reservation is not in HELD status: " + reservation.getStatus());
        }

        reservation.setStatus(ReservationStatus.CONFIRMED);
        reservation.setHoldExpiresAt(null);
        reservationRepository.save(reservation);
        log.info("Confirmed reservation: {}", reservationId);
    }

    @Transactional
    public void cancelReservation(UUID reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));

        if (reservation.getStatus() == ReservationStatus.CANCELLED || reservation.getStatus() == ReservationStatus.EXPIRED) {
            return;
        }

        reservation.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(reservation);

        TimeSlot timeSlot = reservation.getTimeSlot();
        if (timeSlot.getReservedCount() > 0) {
            timeSlot.setReservedCount(timeSlot.getReservedCount() - 1);
            timeSlotRepository.save(timeSlot);
        }

        eventPublisher.publishEvent(new SlotOccupancyChangedEvent(timeSlot.getId(), timeSlot.getResourceGroup().getId(), Instant.now()));
        log.info("Cancelled reservation: {}", reservationId);
    }
}
