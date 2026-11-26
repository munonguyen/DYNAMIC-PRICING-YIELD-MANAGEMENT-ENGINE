package com.yieldengine.repository;

import com.yieldengine.entity.ConversationRead;
import com.yieldengine.entity.ConversationReadId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConversationReadRepository extends JpaRepository<ConversationRead, ConversationReadId> {
}

