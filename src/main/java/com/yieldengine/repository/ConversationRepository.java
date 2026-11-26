package com.yieldengine.repository;

import com.yieldengine.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    @Query("""
        SELECT c FROM Conversation c
        WHERE c.tenantId = :tenantId
          AND c.userId = :userId
          AND ((:bookingId IS NULL AND c.bookingId IS NULL) OR c.bookingId = :bookingId)
        """)
    Optional<Conversation> findThread(
            @Param("tenantId") UUID tenantId,
            @Param("userId") UUID userId,
            @Param("bookingId") UUID bookingId
    );

    List<Conversation> findByTenantIdOrderByLastMessageAtDesc(UUID tenantId);

    List<Conversation> findByUserIdOrderByLastMessageAtDesc(UUID userId);
}

