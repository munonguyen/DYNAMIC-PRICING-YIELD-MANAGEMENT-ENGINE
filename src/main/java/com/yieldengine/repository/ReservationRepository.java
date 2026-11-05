package com.yieldengine.repository;

import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.ReservationId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, ReservationId> {

    @Query("SELECT r FROM Reservation r WHERE r.id.id = :id")
    Optional<Reservation> findByReservationId(@Param("id") UUID id);

    @Query("SELECT r FROM Reservation r WHERE r.bookingId = :bookingId")
    List<Reservation> findByBookingId(@Param("bookingId") UUID bookingId);

    @Query("SELECT r FROM Reservation r WHERE r.groupId = :groupId AND r.id.slotStart = :slotStart")
    List<Reservation> findByGroupIdAndSlotStart(@Param("groupId") UUID groupId, @Param("slotStart") Instant slotStart);

    @Query("SELECT r FROM Reservation r WHERE r.status = 'HELD' AND r.holdExpiresAt < :threshold")
    List<Reservation> findExpiredHolds(@Param("threshold") Instant threshold);
}
