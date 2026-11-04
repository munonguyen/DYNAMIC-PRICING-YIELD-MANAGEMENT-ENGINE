package com.yieldengine.repository;

import com.yieldengine.entity.ConsumedToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ConsumedTokenRepository extends JpaRepository<ConsumedToken, UUID> {
}
