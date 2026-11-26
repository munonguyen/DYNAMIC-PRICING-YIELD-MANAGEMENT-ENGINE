package com.yieldengine.repository;

import com.yieldengine.entity.ConversationRead;
import com.yieldengine.entity.ConversationReadId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.UUID;

@Repository
public interface ConversationReadRepository extends JpaRepository<ConversationRead, ConversationReadId> {
    @Modifying
    @Query(value = """
            INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
            VALUES (:conversationId, :userId, :readAt)
            ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
            WHERE conversation_reads.last_read_at < EXCLUDED.last_read_at
            """, nativeQuery = true)
    void markRead(UUID conversationId, UUID userId, Instant readAt);
}

