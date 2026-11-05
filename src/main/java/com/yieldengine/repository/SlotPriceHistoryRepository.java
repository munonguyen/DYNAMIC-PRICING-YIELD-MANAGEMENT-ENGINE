package com.yieldengine.repository;

import com.yieldengine.entity.SlotPriceHistory;
import com.yieldengine.entity.SlotPriceHistoryId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SlotPriceHistoryRepository extends JpaRepository<SlotPriceHistory, SlotPriceHistoryId> {
}
