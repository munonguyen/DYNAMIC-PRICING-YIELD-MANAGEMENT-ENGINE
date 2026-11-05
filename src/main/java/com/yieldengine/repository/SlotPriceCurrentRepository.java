package com.yieldengine.repository;

import com.yieldengine.entity.SlotId;
import com.yieldengine.entity.SlotPriceCurrent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface SlotPriceCurrentRepository extends JpaRepository<SlotPriceCurrent, SlotId> {

    @Modifying
    @Query(value = """
        UPDATE slot_price_current
        SET current_price = :price,
            rule_set_id = :ruleSetId,
            applied_factors = CAST(:appliedFactors AS jsonb),
            price_seq = :newSeq,
            computed_at = NOW()
        WHERE group_id = :groupId
          AND slot_start = :slotStart
          AND price_seq < :newSeq
        """, nativeQuery = true)
    int updatePriceIfSequenceHigher(
            @Param("groupId") UUID groupId,
            @Param("slotStart") Instant slotStart,
            @Param("price") Long price,
            @Param("ruleSetId") UUID ruleSetId,
            @Param("appliedFactors") String appliedFactorsJson,
            @Param("newSeq") Long newSeq
    );
}
