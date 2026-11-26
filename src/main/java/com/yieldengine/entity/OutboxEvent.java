package com.yieldengine.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "outbox_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "aggregate_type", nullable = false, length = 40)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false, length = 80)
    private String aggregateId;

    @Column(name = "event_type", nullable = false, length = 60)
    private String eventType;

    @Type(JsonType.class)
    @Column(name = "payload", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> payload;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(nullable = false)
    @Builder.Default
    private Integer attempts = 0;

    public static OutboxEvent ofSlotOccupancyChanged(UUID tenantId, UUID groupId, Instant slotStart, UUID reservationId) {
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("groupId", groupId.toString());
        payload.put("slotStart", slotStart.toString());
        payload.put("reservationId", reservationId.toString());

        return OutboxEvent.builder()
                .tenantId(tenantId)
                .aggregateType("SLOT")
                .aggregateId(groupId + "#" + slotStart)
                .eventType("SLOT_OCCUPANCY_CHANGED")
                .payload(payload)
                .build();
    }

    public static OutboxEvent ofBookingQrEmailRequested(
            UUID tenantId,
            UUID reservationId,
            String recipientEmail,
            String recipientName
    ) {
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("reservationId", reservationId.toString());
        payload.put("recipientEmail", recipientEmail);
        if (recipientName != null) {
            payload.put("recipientName", recipientName);
        }

        return OutboxEvent.builder()
                .tenantId(tenantId)
                .aggregateType("RESERVATION")
                .aggregateId(reservationId.toString())
                .eventType("BOOKING_QR_EMAIL_REQUESTED")
                .payload(payload)
                .build();
    }
}

