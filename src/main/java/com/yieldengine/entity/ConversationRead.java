package com.yieldengine.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "conversation_reads")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationRead {

    @EmbeddedId
    private ConversationReadId id;

    @Column(name = "last_read_at", nullable = false)
    private Instant lastReadAt;
}

