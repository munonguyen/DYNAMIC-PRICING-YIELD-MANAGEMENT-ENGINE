package com.yieldengine.utils;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Shared text normalization, UUID parsing, idempotency header resolution, and safe pagination utilities.
 */
public final class CommonTextAndPageUtils {

    private CommonTextAndPageUtils() {
    }

    public static String normalizeUpperCode(String raw) {
        return raw == null ? null : raw.trim().toUpperCase();
    }

    public static String normalizeOptionalUpperCode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim().toUpperCase();
    }

    public static String resolveFirstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary.trim();
        }
        if (fallback != null && !fallback.isBlank()) {
            return fallback.trim();
        }
        return null;
    }

    public static UUID parseUuidOrNull(String rawUuid) {
        if (rawUuid == null || rawUuid.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(rawUuid.trim());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    public static UUID uuidOrDeterministicFromText(UUID explicitUuid, String fallbackText) {
        if (explicitUuid != null) {
            return explicitUuid;
        }
        String seed = fallbackText != null ? fallbackText : "anonymous";
        return UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8));
    }

    public static Pageable boundedPageable(int page, int size, int maxSize) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(maxSize, Math.max(1, size));
        return PageRequest.of(safePage, safeSize);
    }
}

