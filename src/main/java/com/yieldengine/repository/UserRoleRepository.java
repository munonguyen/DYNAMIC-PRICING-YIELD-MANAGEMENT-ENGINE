package com.yieldengine.repository;

import com.yieldengine.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {

    @Query("SELECT ur FROM UserRole ur JOIN FETCH ur.role WHERE ur.user.id = :userId AND ur.revokedAt IS NULL")
    List<UserRole> findActiveByUserId(@Param("userId") UUID userId);

    @Query("SELECT ur FROM UserRole ur JOIN FETCH ur.user JOIN FETCH ur.role WHERE ur.tenantId = :tenantId AND ur.revokedAt IS NULL")
    List<UserRole> findActiveByTenantId(@Param("tenantId") UUID tenantId);

    @Query("""
        SELECT ur FROM UserRole ur
        WHERE ur.user.id = :userId
          AND ur.role.code = :roleCode
          AND ((:tenantId IS NULL AND ur.tenantId IS NULL) OR ur.tenantId = :tenantId)
          AND ur.revokedAt IS NULL
        """)
    Optional<UserRole> findActiveAssignment(
            @Param("userId") UUID userId,
            @Param("roleCode") String roleCode,
            @Param("tenantId") UUID tenantId
    );

    @Query("""
        SELECT COUNT(DISTINCT ur.user.id) FROM UserRole ur
        WHERE ur.role.code = 'ADMIN'
          AND ur.revokedAt IS NULL
          AND ur.user.status = 'ACTIVE'
        """)
    long countActiveAdmins();
}

