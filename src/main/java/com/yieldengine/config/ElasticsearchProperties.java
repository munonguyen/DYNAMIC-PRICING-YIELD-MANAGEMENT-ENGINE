package com.yieldengine.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "elasticsearch")
public class ElasticsearchProperties {

    private boolean enabled = true;
    private String uris = "http://localhost:9200";
    private int connectTimeoutMs = 1500;
    private int readTimeoutMs = 3500;
    private long syncIntervalMs = 30000;
    private String bookingsIndex = "arenapulse_bookings_analytics";
    private String courtsIndex = "arenapulse_court_search";
}

