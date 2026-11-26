package com.yieldengine.dto.marketplace;

import org.springframework.core.io.Resource;

/**
 * Binary media stream descriptor returned when serving stored venue photos.
 */
public record MediaBinaryPayload(
        Resource resource,
        String contentType,
        String fileName,
        long fileSizeBytes
) {
}
