package com.yieldengine.repository;

import com.yieldengine.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, Short> {
    Optional<Permission> findByCode(String code);
}

