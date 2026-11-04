package com.yieldengine.repository;

import com.yieldengine.entity.TimeSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TimeSlotRepository extends JpaRepository<TimeSlot, UUID> {

    List<TimeSlot> findByResourceGroupId(UUID groupId);

    @Query("SELECT ts FROM TimeSlot ts WHERE ts.resourceGroup.id = :groupId AND ts.slotStart >= :start AND ts.slotEnd <= :end ORDER BY ts.slotStart ASC")
    List<TimeSlot> findSlotsInRange(@Param("groupId") UUID groupId, @Param("start") Instant start, @Param("end") Instant end);

    Optional<TimeSlot> findByResourceGroupIdAndSlotStartAndSlotEnd(UUID groupId, Instant slotStart, Instant slotEnd);
}
