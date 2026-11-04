package com.yieldengine.repository;

import com.yieldengine.entity.YieldMatrixRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface YieldMatrixRuleRepository extends JpaRepository<YieldMatrixRule, UUID> {

    @Query("SELECT r FROM YieldMatrixRule r WHERE r.resourceGroup.id = :groupId AND r.active = true ORDER BY r.priority ASC")
    List<YieldMatrixRule> findActiveRulesByGroupId(@Param("groupId") UUID groupId);

    @Query(value = """
        SELECT * FROM yield_matrix_rules
        WHERE group_id = :groupId
          AND active = true
          AND :occ >= min_occupancy_pct AND :occ < max_occupancy_pct
          AND :lead >= min_lead_hours AND :lead < max_lead_hours
        ORDER BY priority ASC
        LIMIT 1
        """, nativeQuery = true)
    Optional<YieldMatrixRule> findMatchingRule(
            @Param("groupId") UUID groupId,
            @Param("occ") BigDecimal occupancyPct,
            @Param("lead") BigDecimal leadHours
    );
}
