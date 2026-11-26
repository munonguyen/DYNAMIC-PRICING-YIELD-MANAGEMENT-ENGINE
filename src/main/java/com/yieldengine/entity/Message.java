package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message {

    @EmbeddedId
    private MessageId id;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(name = "sender_user_id", nullable = false)
    private UUID senderUserId;

    @Column(name = "sender_role", nullable = false)
    private String senderRole;

    @Column(columnDefinition = "text", nullable = false)
    private String body;

    public UUID getMessageId() {
        return id != null ? id.getId() : null;
    }

    public Instant getCreatedAt() {
        return id != null ? id.getCreatedAt() : null;
    }
}

