package com.yieldengine.repository;

import com.yieldengine.entity.CheckIn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CheckInRepository extends JpaRepository<CheckIn, UUID> {
    boolean existsByReservationId(UUID reservationId);
    boolean existsByQrJti(UUID qrJti);
    Optional<CheckIn> findByReservationId(UUID reservationId);
}

