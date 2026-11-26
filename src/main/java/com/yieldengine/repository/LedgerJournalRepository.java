package com.yieldengine.repository;

import com.yieldengine.entity.LedgerJournal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface LedgerJournalRepository extends JpaRepository<LedgerJournal, UUID> {
    boolean existsByIdempotencyKey(String idempotencyKey);
    Optional<LedgerJournal> findByIdempotencyKey(String idempotencyKey);
}

