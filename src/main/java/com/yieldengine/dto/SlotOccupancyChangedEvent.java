package com.yieldengine.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SlotOccupancyChangedEvent {
    private UUID slotId;
    private UUID groupId;
    private Instant timestamp;
}
