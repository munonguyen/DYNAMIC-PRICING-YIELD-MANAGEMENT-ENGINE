package com.yieldengine.repository;

import com.yieldengine.entity.TimeOfDayFactor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TimeOfDayFactorRepository extends JpaRepository<TimeOfDayFactor, UUID> {

    @Query(value = """
        SELECT * FROM time_of_day_factors
        WHERE rule_set_id = :ruleSetId
          AND day_of_week = :dayOfWeek
          AND :hour >= from_hour AND :hour < to_hour
        LIMIT 1
        """, nativeQuery = true)
    Optional<TimeOfDayFactor> findMatchingFactor(
            @Param("ruleSetId") UUID ruleSetId,
            @Param("dayOfWeek") Short dayOfWeek,
            @Param("hour") Short hour
    );
}
