package com.yieldengine.repository;

import com.yieldengine.entity.CommissionRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CommissionRuleRepository extends JpaRepository<CommissionRule, UUID> {

    @Query(value = """
        SELECT * FROM commission_rules cr
        WHERE cr.status = 'ACTIVE'
          AND (cr.tenant_id = :tenantId OR cr.tenant_id IS NULL)
          AND (cr.sport_type_id = :sportTypeId OR cr.sport_type_id IS NULL)
          AND cr.effective_period @> CAST(:atTime AS timestamptz)
        ORDER BY (cr.tenant_id IS NOT NULL) DESC,
                 (cr.sport_type_id IS NOT NULL) DESC
        LIMIT 1
        """, nativeQuery = true)
    Optional<CommissionRule> findMostSpecificActiveRule(
            @Param("tenantId") UUID tenantId,
            @Param("sportTypeId") Short sportTypeId,
            @Param("atTime") Instant atTime
    );

    List<CommissionRule> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
}

