package com.yieldengine.repository;

import com.yieldengine.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {
    Optional<Booking> findByTenantIdAndIdempotencyKey(UUID tenantId, String idempotencyKey);
}
