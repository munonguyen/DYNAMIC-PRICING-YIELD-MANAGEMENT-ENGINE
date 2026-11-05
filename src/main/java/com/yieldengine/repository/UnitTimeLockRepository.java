package com.yieldengine.repository;

import com.yieldengine.entity.UnitTimeLock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UnitTimeLockRepository extends JpaRepository<UnitTimeLock, UUID> {

    Optional<UnitTimeLock> findByReservationId(UUID reservationId);

    @Modifying
    @Query(value = """
        DELETE FROM unit_time_locks
        WHERE unit_id = :unitId
          AND kind = 'HOLD'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
        """, nativeQuery = true)
    int deleteExpiredHoldLocksForUnit(@Param("unitId") UUID unitId);
}
