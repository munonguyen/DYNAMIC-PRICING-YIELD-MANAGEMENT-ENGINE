package com.yieldengine.repository;

import com.yieldengine.entity.SportType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SportTypeRepository extends JpaRepository<SportType, Short> {
    Optional<SportType> findByCode(String code);
    List<SportType> findByStatusOrderByNameAsc(String status);
}

