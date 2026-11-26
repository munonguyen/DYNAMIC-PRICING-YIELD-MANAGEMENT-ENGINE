package com.yieldengine.record.analytics;

import java.util.Map;

/**
 * Document payload for bulk indexing into Elasticsearch analytics/search indices.
 */
public record IndexDoc(
        String id,
        Map<String, Object> source
) {
}

