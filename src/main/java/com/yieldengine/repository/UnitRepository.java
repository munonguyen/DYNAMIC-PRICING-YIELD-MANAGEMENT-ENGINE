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
    String OVERLAPPING_LOCK = """
            EXISTS (SELECT 1 FROM unit_time_locks utl
                WHERE utl.unit_id = u.id
                  AND utl.period && tstzrange(CAST(:slotStart AS timestamptz), CAST(:slotEnd AS timestamptz), '[)')
                  AND (utl.expires_at IS NULL OR utl.expires_at > NOW()))
            """;

    List<Unit> findByResourceGroupId(UUID groupId);

    @Query(value = """
        SELECT u.* FROM units u
        WHERE u.group_id = :groupId
          AND u.status = 'ACTIVE'
          AND NOT
        """ + OVERLAPPING_LOCK + """
        ORDER BY u.unit_number ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    Optional<Unit> findAndLockFirstAvailableUnit(
            @Param("groupId") UUID groupId,
            @Param("slotStart") Instant slotStart,
            @Param("slotEnd") Instant slotEnd
    );

    @Query(value = """
        SELECT u.* FROM units u
        WHERE u.group_id = :groupId AND u.id = :unitId AND u.status = 'ACTIVE' AND NOT
        """ + OVERLAPPING_LOCK + " FOR UPDATE SKIP LOCKED", nativeQuery = true)
    Optional<Unit> findAndLockAvailableUnit(@Param("groupId") UUID groupId, @Param("unitId") UUID unitId,
            @Param("slotStart") Instant slotStart, @Param("slotEnd") Instant slotEnd);

    @Query(value = """
        SELECT u.id AS id, u.unit_number AS "unitNumber", u.status AS status,
        """ + OVERLAPPING_LOCK + """
        AS occupied
        FROM units u WHERE u.group_id = :groupId AND u.status <> 'RETIRED'
        ORDER BY u.unit_number, u.id
        """, nativeQuery = true)
    List<AvailabilityRow> findAvailability(@Param("groupId") UUID groupId,
            @Param("slotStart") Instant slotStart, @Param("slotEnd") Instant slotEnd);

    interface AvailabilityRow {
        UUID getId();
        String getUnitNumber();
        String getStatus();
        boolean getOccupied();
    }
}
