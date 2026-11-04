package com.yieldengine.repository;

import com.yieldengine.entity.SlotPriceSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SlotPriceSnapshotRepository extends JpaRepository<SlotPriceSnapshot, UUID> {
}
