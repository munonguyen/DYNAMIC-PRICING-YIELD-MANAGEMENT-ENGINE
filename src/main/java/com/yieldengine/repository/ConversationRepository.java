package com.yieldengine.repository;

import com.yieldengine.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    @Query(value = """
        SELECT * FROM conversations
        WHERE tenant_id = :tenantId AND user_id = :userId
          AND booking_id IS NOT DISTINCT FROM CAST(:bookingId AS uuid)
        """, nativeQuery = true)
    Optional<Conversation> findThread(
            @Param("tenantId") UUID tenantId,
            @Param("userId") UUID userId,
            @Param("bookingId") UUID bookingId
    );

    @Modifying
    @Query(value = """
            INSERT INTO conversations (id, tenant_id, user_id, booking_id, status)
            VALUES (:id, :tenantId, :userId, :bookingId, 'OPEN')
            ON CONFLICT (tenant_id, user_id, booking_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(UUID id, UUID tenantId, UUID userId, UUID bookingId);

    List<Conversation> findByTenantIdOrderByLastMessageAtDesc(UUID tenantId, Pageable pageable);

    List<Conversation> findByUserIdOrderByLastMessageAtDesc(UUID userId, Pageable pageable);
}

