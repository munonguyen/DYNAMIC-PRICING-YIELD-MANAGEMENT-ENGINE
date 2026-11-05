package com.yieldengine.service.listener;

import com.yieldengine.config.AsyncConfig;
import com.yieldengine.dto.SlotOccupancyChangedEvent;
import com.yieldengine.entity.SlotId;
import com.yieldengine.entity.TimeSlot;
import com.yieldengine.repository.TimeSlotRepository;
import com.yieldengine.service.PricingEngineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class PriceRecalculationListener {

    private final TimeSlotRepository timeSlotRepository;
    private final PricingEngineService pricingEngineService;

    @Async(AsyncConfig.PRICE_RECALCULATION_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOccupancyChanged(SlotOccupancyChangedEvent event) {
        log.info("Received SlotOccupancyChangedEvent for group={} at {}, recalculating price asynchronously...",
                event.getGroupId(), event.getSlotStart());
        try {
            SlotId slotId = new SlotId(event.getGroupId(), event.getSlotStart());
            Optional<TimeSlot> slotOpt = timeSlotRepository.findById(slotId);
            if (slotOpt.isPresent()) {
                pricingEngineService.recalculateAndSnapshot(slotOpt.get());
                log.info("Successfully recalculated price and warmed cache for group={} at {}",
                        event.getGroupId(), event.getSlotStart());
            } else {
                log.warn("TimeSlot no longer exists for group={} at {}", event.getGroupId(), event.getSlotStart());
            }
        } catch (Exception e) {
            log.error("Failed to asynchronously recalculate price for group={} at {}: {}",
                    event.getGroupId(), event.getSlotStart(), e.getMessage(), e);
        }
    }
}
