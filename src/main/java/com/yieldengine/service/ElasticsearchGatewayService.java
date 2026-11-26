package com.yieldengine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.ElasticsearchProperties;
import com.yieldengine.dto.analytics.IndexDoc;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * Lightweight, zero-bloat Elasticsearch 8 REST gateway executing bulk indexing,
 * fuzzy Vietnamese full-text search (_search), and real-time analytics aggregations (_search?size=0).
 */
@Slf4j
@Service
public class ElasticsearchGatewayService {

    private final ElasticsearchProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public ElasticsearchGatewayService(ElasticsearchProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(500, properties.getConnectTimeoutMs())))
                .build();
    }

    public boolean isEnabled() {
        return properties.isEnabled();
    }

    public boolean isHealthy() {
        if (!properties.isEnabled()) return false;
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl() + "/_cluster/health?timeout=1s"))
                    .timeout(Duration.ofMillis(properties.getConnectTimeoutMs()))
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            return resp.statusCode() >= 200 && resp.statusCode() < 300;
        } catch (Exception ex) {
            return false;
        }
    }

    public void ensureIndicesExist() {
        if (!properties.isEnabled()) return;
        ensureSingleIndex(
                properties.getBookingsIndex(),
                """
                {
                  "mappings": {
                    "properties": {
                      "reservationId":   { "type": "keyword" },
                      "tenantId":        { "type": "keyword" },
                      "groupId":         { "type": "keyword" },
                      "groupName":       { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
                      "venueName":       { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
                      "sportCode":       { "type": "keyword" },
                      "sportName":       { "type": "keyword" },
                      "status":          { "type": "keyword" },
                      "paymentProvider": { "type": "keyword" },
                      "slotStart":       { "type": "date" },
                      "slotHour":        { "type": "integer" },
                      "lockedPrice":     { "type": "long" },
                      "depositAmount":   { "type": "long" },
                      "paidAmount":      { "type": "long" },
                      "commissionAmount":{ "type": "long" }
                    }
                  }
                }
                """
        );
        ensureSingleIndex(
                properties.getCourtsIndex(),
                """
                {
                  "mappings": {
                    "properties": {
                      "groupId":        { "type": "keyword" },
                      "groupCode":      { "type": "keyword" },
                      "groupName":      { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
                      "tenantId":       { "type": "keyword" },
                      "venueName":      { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
                      "venueAddress":   { "type": "text" },
                      "sportCode":      { "type": "keyword" },
                      "sportName":      { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
                      "publishStatus":  { "type": "keyword" },
                      "basePrice":      { "type": "long" },
                      "minPrice":       { "type": "long" },
                      "maxPrice":       { "type": "long" },
                      "depositPercent": { "type": "integer" },
                      "slotMinutes":    { "type": "integer" }
                    }
                  }
                }
                """
        );
    }

    public int bulkIndex(String indexName, List<IndexDoc> docs) {
        if (!properties.isEnabled() || docs == null || docs.isEmpty()) return 0;
        try {
            StringBuilder ndjson = new StringBuilder();
            for (IndexDoc doc : docs) {
                ndjson.append("{\"index\":{\"_index\":\"")
                        .append(indexName)
                        .append("\",\"_id\":\"")
                        .append(doc.id())
                        .append("\"}}\n");
                ndjson.append(objectMapper.writeValueAsString(doc.source())).append("\n");
            }
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl() + "/_bulk?refresh=true"))
                    .timeout(Duration.ofMillis(properties.getReadTimeoutMs()))
                    .header("Content-Type", "application/x-ndjson")
                    .POST(HttpRequest.BodyPublishers.ofString(ndjson.toString(), StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                return docs.size();
            }
            log.warn("Elasticsearch bulk returned HTTP {}: {}", resp.statusCode(), resp.body());
        } catch (Exception ex) {
            log.debug("Elasticsearch bulk skipped: {}", ex.getMessage());
        }
        return 0;
    }

    public JsonNode searchIndex(String indexName, Map<String, Object> queryDsl) {
        if (!properties.isEnabled()) return null;
        try {
            String body = objectMapper.writeValueAsString(queryDsl);
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl() + "/" + indexName + "/_search"))
                    .timeout(Duration.ofMillis(properties.getReadTimeoutMs()))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                return objectMapper.readTree(resp.body());
            }
            log.debug("Elasticsearch _search HTTP {}: {}", resp.statusCode(), resp.body());
        } catch (Exception ex) {
            log.debug("Elasticsearch _search unavailable: {}", ex.getMessage());
        }
        return null;
    }

    public ElasticsearchProperties getProperties() {
        return properties;
    }

    private void ensureSingleIndex(String indexName, String mappingJson) {
        try {
            HttpRequest headReq = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl() + "/" + indexName))
                    .timeout(Duration.ofMillis(properties.getConnectTimeoutMs()))
                    .method("HEAD", HttpRequest.BodyPublishers.noBody())
                    .build();
            HttpResponse<Void> headResp = httpClient.send(headReq, HttpResponse.BodyHandlers.discarding());
            if (headResp.statusCode() == 404) {
                HttpRequest createReq = HttpRequest.newBuilder()
                        .uri(URI.create(baseUrl() + "/" + indexName))
                        .timeout(Duration.ofMillis(properties.getReadTimeoutMs()))
                        .header("Content-Type", "application/json")
                        .PUT(HttpRequest.BodyPublishers.ofString(mappingJson, StandardCharsets.UTF_8))
                        .build();
                httpClient.send(createReq, HttpResponse.BodyHandlers.ofString());
                log.info("Created Elasticsearch index [{}]", indexName);
            }
        } catch (Exception ex) {
            log.debug("Could not ensure Elasticsearch index {}: {}", indexName, ex.getMessage());
        }
    }

    private String baseUrl() {
        String raw = properties.getUris() != null ? properties.getUris().trim() : "http://localhost:9200";
        return raw.endsWith("/") ? raw.substring(0, raw.length() - 1) : raw;
    }
}

