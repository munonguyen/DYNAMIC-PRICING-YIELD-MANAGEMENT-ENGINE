package com.yieldengine.repository;

import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, UUID> {

    List<Reservation> findByTimeSlotId(UUID slotId);

    List<Reservation> findByUserId(String userId);

    long countByTimeSlotIdAndStatusIn(UUID slotId, Collection<ReservationStatus> statuses);

    List<Reservation> findByStatusAndHoldExpiresAtBefore(ReservationStatus status, Instant expiryThreshold);
}
