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

    List<YieldMatrixRule> findByRuleSetId(UUID ruleSetId);

    @Query(value = """
        SELECT * FROM yield_matrix_rules
        WHERE rule_set_id = :ruleSetId
          AND occupancy_pct @> :occ::numeric
          AND lead_hours @> :lead::numeric
        LIMIT 1
        """, nativeQuery = true)
    Optional<YieldMatrixRule> findMatchingRule(
            @Param("ruleSetId") UUID ruleSetId,
            @Param("occ") BigDecimal occupancyPct,
            @Param("lead") BigDecimal leadHours
    );
}
