package com.yieldengine.service.listener;

import com.yieldengine.config.AsyncConfig;
import com.yieldengine.dto.SlotOccupancyChangedEvent;
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
        log.info("Received SlotOccupancyChangedEvent for slotId={}, recalculating price asynchronously...", event.getSlotId());
        try {
            Optional<TimeSlot> slotOpt = timeSlotRepository.findById(event.getSlotId());
            if (slotOpt.isPresent()) {
                pricingEngineService.recalculateAndSnapshot(slotOpt.get());
                log.info("Successfully recalculated and warmed cache for slotId={}", event.getSlotId());
            } else {
                log.warn("TimeSlot {} no longer exists during recalculation", event.getSlotId());
            }
        } catch (Exception e) {
            log.error("Failed to asynchronously recalculate price for slot: {}", event.getSlotId(), e);
        }
    }
}
