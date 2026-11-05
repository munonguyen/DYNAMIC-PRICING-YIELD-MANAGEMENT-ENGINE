package com.yieldengine.repository;

import com.yieldengine.entity.SlotId;
import com.yieldengine.entity.TimeSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface TimeSlotRepository extends JpaRepository<TimeSlot, SlotId> {

    @Query("SELECT ts FROM TimeSlot ts WHERE ts.id.groupId = :groupId ORDER BY ts.id.slotStart ASC")
    List<TimeSlot> findByGroupId(@Param("groupId") UUID groupId);

    @Query("SELECT ts FROM TimeSlot ts WHERE ts.id.groupId = :groupId AND ts.id.slotStart >= :start AND ts.id.slotStart < :end ORDER BY ts.id.slotStart ASC")
    List<TimeSlot> findSlotsInRange(@Param("groupId") UUID groupId, @Param("start") Instant start, @Param("end") Instant end);
}
