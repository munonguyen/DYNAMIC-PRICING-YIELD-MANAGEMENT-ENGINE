package com.yieldengine.repository;

import com.yieldengine.entity.ResourceGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResourceGroupRepository extends JpaRepository<ResourceGroup, UUID> {
    Optional<ResourceGroup> findByTenantIdAndCode(UUID tenantId, String code);
    Optional<ResourceGroup> findByCode(String code);
    List<ResourceGroup> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    @Query("""
        SELECT rg FROM ResourceGroup rg
        JOIN FETCH rg.tenant t
        JOIN FETCH rg.sportType st
        WHERE rg.publishStatus = 'PUBLISHED'
          AND rg.status = 'ACTIVE'
          AND t.status = 'ACTIVE'
          AND (:sportCode IS NULL OR st.code = :sportCode)
          AND (:tenantId IS NULL OR t.id = :tenantId)
        ORDER BY rg.name ASC
        """)
    List<ResourceGroup> findPublishedListings(
            @Param("sportCode") String sportCode,
            @Param("tenantId") UUID tenantId
    );
}
