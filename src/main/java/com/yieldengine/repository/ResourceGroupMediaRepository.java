package com.yieldengine.repository;

import com.yieldengine.entity.ResourceGroupMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ResourceGroupMediaRepository extends JpaRepository<ResourceGroupMedia, UUID> {

    List<ResourceGroupMedia> findByResourceGroupIdOrderByCoverDescDisplayOrderAscCreatedAtAsc(UUID resourceGroupId);

    List<ResourceGroupMedia> findByResourceGroupIdInOrderByCoverDescDisplayOrderAscCreatedAtAsc(Collection<UUID> resourceGroupIds);

    long countByResourceGroupId(UUID resourceGroupId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ResourceGroupMedia m SET m.cover = false WHERE m.resourceGroupId = :groupId AND m.cover = true")
    int clearCoverForGroup(@Param("groupId") UUID groupId);
}
