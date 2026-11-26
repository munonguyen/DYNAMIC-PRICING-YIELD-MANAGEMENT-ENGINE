package com.yieldengine.repository;

import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.ReservationId;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
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

    @Query("SELECT r FROM Reservation r WHERE r.id.id = :id AND r.id.slotStart = :slotStart")
    Optional<Reservation> findByIdAndSlotStart(@Param("id") UUID id, @Param("slotStart") Instant slotStart);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Reservation r WHERE r.id.id = :id")
    Optional<Reservation> lockByReservationId(@Param("id") UUID id);

    @Query("SELECT r FROM Reservation r WHERE r.bookingId = :bookingId")
    List<Reservation> findByBookingId(@Param("bookingId") UUID bookingId);

    @Query("SELECT r FROM Reservation r WHERE r.userId = :userId ORDER BY r.id.slotStart DESC")
    List<Reservation> findByUserIdOrderBySlotStartDesc(@Param("userId") UUID userId);

    @Query("SELECT r FROM Reservation r WHERE r.groupId = :groupId AND r.id.slotStart = :slotStart")
    List<Reservation> findByGroupIdAndSlotStart(@Param("groupId") UUID groupId, @Param("slotStart") Instant slotStart);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Reservation r WHERE r.status = 'HELD' AND r.holdExpiresAt < :threshold")
    List<Reservation> findExpiredHolds(@Param("threshold") Instant threshold);
}
