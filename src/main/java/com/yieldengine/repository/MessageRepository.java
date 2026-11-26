package com.yieldengine.repository;

import com.yieldengine.entity.Message;
import com.yieldengine.entity.MessageId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageRepository extends JpaRepository<Message, MessageId> {
    List<Message> findByConversationIdOrderByIdCreatedAtAsc(UUID conversationId, Pageable pageable);
}

