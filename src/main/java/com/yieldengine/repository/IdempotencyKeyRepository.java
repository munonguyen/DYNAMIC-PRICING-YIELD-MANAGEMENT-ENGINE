package com.yieldengine.repository;

import com.yieldengine.entity.IdempotencyKey;
import com.yieldengine.entity.IdempotencyKeyId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IdempotencyKeyRepository extends JpaRepository<IdempotencyKey, IdempotencyKeyId> {
}
