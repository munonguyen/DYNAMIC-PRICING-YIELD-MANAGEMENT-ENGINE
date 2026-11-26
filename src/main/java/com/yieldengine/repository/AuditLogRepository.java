package com.yieldengine.repository;

import com.yieldengine.entity.AuditLog;
import com.yieldengine.entity.AuditLogId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, AuditLogId> {

    @Query("""
        SELECT a FROM AuditLog a
        WHERE (:tenantId IS NULL OR a.tenantId = :tenantId)
          AND (:actorUserId IS NULL OR a.actorUserId = :actorUserId)
          AND (:action IS NULL OR a.action = :action)
          AND a.id.createdAt >= :fromTime
          AND a.id.createdAt <= :toTime
        ORDER BY a.id.createdAt DESC
        """)
    Page<AuditLog> searchAuditLogs(
            @Param("tenantId") UUID tenantId,
            @Param("actorUserId") UUID actorUserId,
            @Param("action") String action,
            @Param("fromTime") Instant fromTime,
            @Param("toTime") Instant toTime,
            Pageable pageable
    );
}

