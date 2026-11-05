package com.yieldengine.repository;

import com.yieldengine.entity.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    @Query(value = """
        SELECT * FROM outbox_events
        WHERE published_at IS NULL
        ORDER BY id ASC
        LIMIT 100
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    List<OutboxEvent> findPendingEventsForRelay();
}
