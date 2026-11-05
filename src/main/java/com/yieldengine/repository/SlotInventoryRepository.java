package com.yieldengine.repository;

import com.yieldengine.entity.SlotId;
import com.yieldengine.entity.SlotInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SlotInventoryRepository extends JpaRepository<SlotInventory, SlotId> {

    @Modifying
    @Query(value = """
        UPDATE slot_inventory
        SET held_count = held_count + 1, updated_at = NOW()
        WHERE group_id = :groupId
          AND slot_start = :slotStart
          AND (held_count + confirmed_count) < total_capacity
        """, nativeQuery = true)
    int incrementHeldCountIfAvailable(
            @Param("groupId") UUID groupId,
            @Param("slotStart") Instant slotStart
    );

    @Modifying
    @Query(value = """
        UPDATE slot_inventory
        SET held_count = held_count - 1, confirmed_count = confirmed_count + 1, updated_at = NOW()
        WHERE group_id = :groupId
          AND slot_start = :slotStart
          AND held_count > 0
        """, nativeQuery = true)
    int confirmHold(
            @Param("groupId") UUID groupId,
            @Param("slotStart") Instant slotStart
    );

    @Modifying
    @Query(value = """
        UPDATE slot_inventory
        SET held_count = GREATEST(0, held_count - 1), updated_at = NOW()
        WHERE group_id = :groupId
          AND slot_start = :slotStart
        """, nativeQuery = true)
    int releaseHold(
            @Param("groupId") UUID groupId,
            @Param("slotStart") Instant slotStart
    );
}
