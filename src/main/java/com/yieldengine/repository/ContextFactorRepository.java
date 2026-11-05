package com.yieldengine.repository;

import com.yieldengine.entity.ContextFactor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface ContextFactorRepository extends JpaRepository<ContextFactor, UUID> {

    @Query(value = """
        SELECT * FROM context_factors
        WHERE group_id = :groupId
          AND period @> :slotTime::timestamptz
        """, nativeQuery = true)
    List<ContextFactor> findActiveContextFactors(
            @Param("groupId") UUID groupId,
            @Param("slotTime") Instant slotTime
    );
}
