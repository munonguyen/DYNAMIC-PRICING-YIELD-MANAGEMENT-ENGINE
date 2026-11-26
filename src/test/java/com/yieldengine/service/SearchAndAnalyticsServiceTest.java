package com.yieldengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import com.yieldengine.config.ElasticsearchProperties;
import com.yieldengine.record.analytics.AnalyticsDashboardResponse;
import com.yieldengine.record.analytics.CourtSearchResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class SearchAndAnalyticsServiceTest {

    private HttpServer mockEsServer;
    private int esPort;
    private ObjectMapper objectMapper;
    private JdbcTemplate mockJdbc;

    @BeforeEach
    void setUp() throws Exception {
        objectMapper = new ObjectMapper().findAndRegisterModules();
        mockJdbc = Mockito.mock(JdbcTemplate.class);
        when(mockJdbc.query(anyString(), any(RowMapper.class), Mockito.<Object[]>any()))
                .thenReturn(List.of());

        mockEsServer = HttpServer.create(new InetSocketAddress(0), 0);
        esPort = mockEsServer.getAddress().getPort();

        mockEsServer.createContext("/_cluster/health", exchange -> {
            byte[] body = "{\"status\":\"green\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(body); }
        });

        mockEsServer.createContext("/arenapulse_bookings_analytics/_search", exchange -> {
            long nowMs = System.currentTimeMillis();
            String json = """
                {
                  "hits": { "total": { "value": 12 } },
                  "aggregations": {
                    "gross_revenue": { "value": 4200000.0 },
                    "commission_sum": { "value": 420000.0 },
                    "escrow_held": { "doc_count": 3, "amount": { "value": 1050000.0 } },
                    "pending_checkins": { "doc_count": 3 },
                    "completed_revenue": { "doc_count": 9, "amount": { "value": 3150000.0 } },
                    "daily_revenue": {
                      "buckets": [
                        { "key": %d, "doc_count": 4, "court_rev": { "value": 1600000.0 } }
                      ]
                    },
                    "hourly_curve": {
                      "buckets": [
                        { "key": 19, "doc_count": 5, "avg_price": { "value": 350000.0 } }
                      ]
                    },
                    "payment_channels": {
                      "buckets": [
                        { "key": "VNPAY_ESCROW", "doc_count": 6, "channel_sum": { "value": 1200000.0 } },
                        { "key": "VIETQR_NAPAS", "doc_count": 6, "channel_sum": { "value": 900000.0 } }
                      ]
                    },
                    "sport_breakdown": {
                      "buckets": [
                        { "key": "Pickleball", "doc_count": 12, "sport_sum": { "value": 4200000.0 } }
                      ]
                    },
                    "court_breakdown": { "buckets": [] }
                  }
                }
                """.formatted(nowMs);
            byte[] body = json.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(body); }
        });

        mockEsServer.createContext("/arenapulse_court_search/_search", exchange -> {
            String gid = UUID.randomUUID().toString();
            String tid = UUID.randomUUID().toString();
            String json = """
                {
                  "hits": {
                    "total": { "value": 1 },
                    "hits": [
                      {
                        "_score": 4.25,
                        "_source": {
                          "groupId": "%s",
                          "groupCode": "PICKLE_01",
                          "groupName": "Cụm 10 Sân Pickleball Bách Khoa",
                          "tenantId": "%s",
                          "venueName": "Bách Khoa SportHub",
                          "venueAddress": "Số 1 Đại Cồ Việt",
                          "sportCode": "PICKLEBALL",
                          "sportName": "Pickleball",
                          "basePrice": 200000,
                          "minPrice": 120000,
                          "maxPrice": 350000,
                          "depositPercent": 35,
                          "slotMinutes": 60
                        }
                      }
                    ]
                  }
                }
                """.formatted(gid, tid);
            byte[] body = json.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(body); }
        });

        mockEsServer.start();
    }

    @AfterEach
    void tearDown() {
        if (mockEsServer != null) mockEsServer.stop(0);
    }

    @Test
    void dashboardUsesPostgresEvenWhenCourtSearchUsesElasticsearch() {
        ElasticsearchProperties props = new ElasticsearchProperties();
        props.setEnabled(true);
        props.setUris("http://localhost:" + esPort);

        ElasticsearchGatewayService gateway = new ElasticsearchGatewayService(props, objectMapper);
        SearchAndAnalyticsSyncService syncService = new SearchAndAnalyticsSyncService(mockJdbc, gateway);

        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        AnalyticsDashboardResponse resp = syncService.getDashboardAnalytics("LESSOR", tenantId, 7);

        assertEquals("POSTGRESQL_DB", resp.dataSource());
        assertEquals(0L, resp.grossRevenue());
        assertEquals(0L, resp.escrowHeld());
        assertEquals(0L, resp.commissionAmount());
        assertEquals(0, resp.totalBookings());
        assertEquals(0, resp.pendingCheckins());
        assertEquals(0, resp.channelBreakdown().size());

        CourtSearchResponse searchResp = syncService.searchCourts("Pickleball", "PICKLEBALL", null);
        assertEquals("ELASTICSEARCH_CQRS", searchResp.dataSource());
        assertEquals(1L, searchResp.totalHits());
        assertEquals("Cụm 10 Sân Pickleball Bách Khoa", searchResp.hits().get(0).groupName());
    }

    @Test
    void testGracefulPostgresFallbackWhenElasticsearchOffline() {
        ElasticsearchProperties props = new ElasticsearchProperties();
        props.setEnabled(false);

        ElasticsearchGatewayService gateway = new ElasticsearchGatewayService(props, objectMapper);
        SearchAndAnalyticsSyncService syncService = new SearchAndAnalyticsSyncService(mockJdbc, gateway);

        when(mockJdbc.queryForList(anyString(), Mockito.<Object[]>any())).thenReturn(List.of());
        AnalyticsDashboardResponse resp = syncService.getDashboardAnalytics("PLATFORM", null, 7);

        assertEquals("POSTGRESQL_DB", resp.dataSource());
        assertEquals(0L, resp.grossRevenue());
        assertEquals(0, resp.totalBookings());
    }
}

