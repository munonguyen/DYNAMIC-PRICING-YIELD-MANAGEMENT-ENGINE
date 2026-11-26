package com.yieldengine.repository;

import com.yieldengine.entity.LedgerEntry;
import com.yieldengine.entity.LedgerEntryId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, LedgerEntryId> {

    @Query("""
        SELECT le FROM LedgerEntry le
        WHERE (:tenantId IS NULL OR le.tenantId = :tenantId)
          AND le.id.occurredAt >= :fromTime
          AND le.id.occurredAt <= :toTime
        ORDER BY le.id.occurredAt DESC
        """)
    Page<LedgerEntry> findEntriesFiltered(
            @Param("tenantId") UUID tenantId,
            @Param("fromTime") Instant fromTime,
            @Param("toTime") Instant toTime,
            Pageable pageable
    );

    List<LedgerEntry> findByJournalId(UUID journalId);

    @Query("""
        SELECT COALESCE(SUM(le.amount), 0) FROM LedgerEntry le
        WHERE (:tenantId IS NULL OR le.tenantId = :tenantId)
          AND le.accountCode = :accountCode
          AND le.direction = :direction
          AND le.id.occurredAt >= :fromTime
          AND le.id.occurredAt <= :toTime
        """)
    Long sumAmountByAccountAndDirection(
            @Param("tenantId") UUID tenantId,
            @Param("accountCode") String accountCode,
            @Param("direction") String direction,
            @Param("fromTime") Instant fromTime,
            @Param("toTime") Instant toTime
    );
}

