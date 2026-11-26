package com.yieldengine.record.analytics;

import java.util.List;
public record CourtSearchResponse(
        String dataSource,
        long queryLatencyMs,
        long totalHits,
        List<CourtSearchResultDto> hits
) {}
