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
          AND EXISTS (SELECT 1 FROM LedgerJournal lj WHERE lj.id = le.journalId
              AND substring(lj.idempotencyKey, 1, 13) <> 'SEED_V10_JRN_')
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
        SELECT COALESCE(SUM(le.amount), 0) FROM LedgerEntry le, Payment p
        WHERE le.paymentId = p.id AND p.paymentType = 'REFUND' AND p.status = 'SUCCESS' AND p.gatewayVerifiedAt IS NOT NULL
          AND le.accountCode = 'GATEWAY_CLEARING' AND le.direction = 'CREDIT'
          AND (:tenantId IS NULL OR le.tenantId = :tenantId)
          AND le.id.occurredAt >= :fromTime AND le.id.occurredAt <= :toTime
        """)
    long sumVerifiedRefunds(@Param("tenantId") UUID tenantId, @Param("fromTime") Instant fromTime, @Param("toTime") Instant toTime);

    @Query("""
        SELECT COALESCE(SUM(le.amount), 0) FROM LedgerEntry le
        WHERE (:tenantId IS NULL OR le.tenantId = :tenantId)
          AND EXISTS (SELECT 1 FROM LedgerJournal lj WHERE lj.id = le.journalId
              AND substring(lj.idempotencyKey, 1, 13) <> 'SEED_V10_JRN_')
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

