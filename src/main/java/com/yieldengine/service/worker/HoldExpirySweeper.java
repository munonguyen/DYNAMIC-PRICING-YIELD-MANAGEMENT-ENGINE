package com.yieldengine.service.worker;

import com.yieldengine.entity.OutboxEvent;
import com.yieldengine.entity.Reservation;
import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.repository.OutboxEventRepository;
import com.yieldengine.repository.ReservationRepository;
import com.yieldengine.repository.SlotInventoryRepository;
import com.yieldengine.repository.UnitTimeLockRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Background sweeper releasing unpaid HELD reservations past hold_expires_at (BR-BKG-05).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class HoldExpirySweeper {

    private final ReservationRepository reservationRepository;
    private final UnitTimeLockRepository unitTimeLockRepository;
    private final SlotInventoryRepository slotInventoryRepository;
    private final OutboxEventRepository outboxEventRepository;

    @Scheduled(fixedDelayString = "${pricing.hold.sweep-ms:15000}")
    @Transactional
    public int sweepExpiredHolds() {
        Instant now = Instant.now();
        List<Reservation> expired = reservationRepository.findExpiredHolds(now);
        if (expired.isEmpty()) {
            return 0;
        }

        for (Reservation reservation : expired) {
            reservation.setStatus(ReservationStatus.EXPIRED.name());
            reservationRepository.save(reservation);

            unitTimeLockRepository.findByReservationId(reservation.getReservationId())
                    .filter(lock -> "HOLD".equals(lock.getKind()))
                    .ifPresent(unitTimeLockRepository::delete);

            slotInventoryRepository.releaseHold(reservation.getGroupId(), reservation.getSlotStart());

            outboxEventRepository.save(OutboxEvent.ofSlotOccupancyChanged(
                    reservation.getTenantId(),
                    reservation.getGroupId(),
                    reservation.getSlotStart(),
                    reservation.getReservationId()
            ));
        }

        log.info("Swept {} expired HELD reservations and released court inventory", expired.size());
        return expired.size();
    }
}

