package com.yieldengine.repository;

import com.yieldengine.entity.TokenSigningKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TokenSigningKeyRepository extends JpaRepository<TokenSigningKey, String> {
    Optional<TokenSigningKey> findFirstByStatusOrderByNotBeforeDesc(String status);
}
