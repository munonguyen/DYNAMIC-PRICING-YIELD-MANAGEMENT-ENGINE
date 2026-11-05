package com.yieldengine.repository;

import com.yieldengine.entity.ResourceGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResourceGroupRepository extends JpaRepository<ResourceGroup, UUID> {
    Optional<ResourceGroup> findByTenantIdAndCode(UUID tenantId, String code);
    Optional<ResourceGroup> findByCode(String code);
}
