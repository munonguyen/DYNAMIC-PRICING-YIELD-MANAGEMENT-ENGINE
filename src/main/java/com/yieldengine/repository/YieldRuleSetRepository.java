package com.yieldengine.repository;

import com.yieldengine.entity.YieldRuleSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface YieldRuleSetRepository extends JpaRepository<YieldRuleSet, UUID> {

    @Query(value = """
        SELECT * FROM yield_rule_sets
        WHERE group_id = :groupId
          AND status = 'ACTIVE'
          AND effective @> :slotTime::timestamptz
        LIMIT 1
        """, nativeQuery = true)
    Optional<YieldRuleSet> findActiveRuleSetForTime(
            @Param("groupId") UUID groupId,
            @Param("slotTime") Instant slotTime
    );
}
