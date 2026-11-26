package com.yieldengine.repository;

import com.yieldengine.entity.CancellationPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CancellationPolicyRepository extends JpaRepository<CancellationPolicy, UUID> {
    List<CancellationPolicy> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    Optional<CancellationPolicy> findByIdAndTenantId(UUID id, UUID tenantId);
}

