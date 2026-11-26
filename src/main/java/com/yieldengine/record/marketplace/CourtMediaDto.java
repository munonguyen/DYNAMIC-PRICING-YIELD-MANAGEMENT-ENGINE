package com.yieldengine.record.marketplace;

import java.time.Instant;
import java.util.UUID;
public record CourtMediaDto(
        UUID mediaId,
        UUID groupId,
        String url,
        String fileName,
        String contentType,
        Long fileSizeBytes,
        String caption,
        String sourceType,
        boolean isCover,
        int displayOrder,
        Instant createdAt
) {
}
