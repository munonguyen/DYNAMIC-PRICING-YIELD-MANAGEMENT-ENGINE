package com.yieldengine.repository;

import com.yieldengine.entity.Unit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
              SELECT 1 FROM reservations r
              WHERE r.unit_id = u.id
                AND r.slot_id = :slotId
                AND r.status IN ('HELD', 'CONFIRMED')
          )
        ORDER BY u.unit_number ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    Optional<Unit> findAndLockFirstAvailableUnit(@Param("groupId") UUID groupId, @Param("slotId") UUID slotId);
}
