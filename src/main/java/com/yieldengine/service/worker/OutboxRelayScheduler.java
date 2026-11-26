package com.yieldengine.service.worker;

import com.yieldengine.entity.OutboxEvent;
import com.yieldengine.entity.SlotId;
import com.yieldengine.repository.OutboxEventRepository;
import com.yieldengine.repository.TimeSlotRepository;
import com.yieldengine.service.PricingEngineService;
import com.yieldengine.service.QrTicketEmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Transactional Outbox Relay Worker polling with FOR UPDATE SKIP LOCKED (NFR-12, BR-PRC-05).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxRelayScheduler {

    private final OutboxEventRepository outboxEventRepository;
    private final TimeSlotRepository timeSlotRepository;
    private final PricingEngineService pricingEngineService;
    private final QrTicketEmailService qrTicketEmailService;

    @Scheduled(fixedDelayString = "${pricing.outbox.poll-ms:5000}")
    @Transactional
    public int relayPendingEvents() {
        List<OutboxEvent> pending = outboxEventRepository.findPendingEventsForRelay();
        if (pending.isEmpty()) {
            return 0;
        }

        Instant now = Instant.now();
        int processed = 0;
        for (OutboxEvent event : pending) {
            try {
                if ("SLOT_OCCUPANCY_CHANGED".equals(event.getEventType())) {
                    Map<String, Object> payload = event.getPayload();
                    UUID groupId = UUID.fromString(String.valueOf(payload.get("groupId")));
                    Instant slotStart = Instant.parse(String.valueOf(payload.get("slotStart")));
                    timeSlotRepository.findById(new SlotId(groupId, slotStart))
                            .ifPresent(pricingEngineService::recalculateAndSnapshot);
                } else if ("BOOKING_QR_EMAIL_REQUESTED".equals(event.getEventType())) {
                    Map<String, Object> payload = event.getPayload();
                    UUID reservationId = UUID.fromString(String.valueOf(payload.get("reservationId")));
                    String recipientEmail = payload.get("recipientEmail") != null
                            ? String.valueOf(payload.get("recipientEmail")) : null;
                    String recipientName = payload.get("recipientName") != null
                            ? String.valueOf(payload.get("recipientName")) : null;
                    qrTicketEmailService.sendQrTicketEmailForReservation(reservationId, recipientEmail, recipientName);
                }
                event.setPublishedAt(now);
                event.setAttempts(event.getAttempts() + 1);
                processed++;
            } catch (Exception ex) {
                event.setAttempts(event.getAttempts() + 1);
                log.warn("Failed processing outbox event id={} (attempt={}): {}",
                        event.getId(), event.getAttempts(), ex.getMessage());
            }
        }
        outboxEventRepository.saveAll(pending);
        return processed;
    }
}

