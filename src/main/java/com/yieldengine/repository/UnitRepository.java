package com.yieldengine.repository;

import com.yieldengine.entity.Unit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UnitRepository extends JpaRepository<Unit, UUID> {

    List<Unit> findByResourceGroupId(UUID groupId);

    @Query(value = """
        SELECT u.* FROM units u
        WHERE u.group_id = :groupId
          AND u.status = 'ACTIVE'
          AND NOT EXISTS (
              SELECT 1 FROM unit_time_locks utl
              WHERE utl.unit_id = u.id
                AND utl.period && tstzrange(:slotStart, :slotEnd, '[)')
                AND (utl.expires_at IS NULL OR utl.expires_at > NOW())
          )
        ORDER BY u.unit_number ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    Optional<Unit> findAndLockFirstAvailableUnit(
            @Param("groupId") UUID groupId,
            @Param("slotStart") Instant slotStart,
            @Param("slotEnd") Instant slotEnd
    );
}
