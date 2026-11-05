package com.yieldengine.dto;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SlotOccupancyChangedEvent {
    private UUID groupId;
    private Instant slotStart;
    private Instant timestamp;
}
