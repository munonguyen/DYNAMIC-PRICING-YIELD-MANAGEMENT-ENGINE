package com.yieldengine.service;

import com.yieldengine.utils.CommonTextAndPageUtils;

import com.fasterxml.jackson.databind.JsonNode;
import com.yieldengine.dto.SlotOccupancyChangedEvent;
import com.yieldengine.record.analytics.IndexDoc;
import com.yieldengine.record.analytics.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * CQRS Read & Analytics Synchronization Engine bridging PostgreSQL (System of Record)
 * and Elasticsearch 8 (Ultra-fast Read & Real-time Aggregation Store).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchAndAnalyticsSyncService implements ApplicationRunner {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter SHORT_DATE = DateTimeFormatter.ofPattern("dd/MM");
    private static final DateTimeFormatter LABEL_DATE = DateTimeFormatter.ofPattern("EEE dd/MM", Locale.forLanguageTag("vi-VN"));

    private final JdbcTemplate jdbcTemplate;
    private final ElasticsearchGatewayService esGateway;

    @Override
    @Profile("!test")
    public void run(ApplicationArguments args) {
        if (!esGateway.isEnabled()) return;
        try {
            if (esGateway.isHealthy()) {
                ReindexResponse res = syncAllFromDatabase();
                log.info("Elasticsearch initial CQRS sync completed: {} bookings, {} courts in {}ms",
                        res.indexedBookings(), res.indexedCourts(), res.durationMs());
            }
        } catch (Exception ex) {
            log.warn("Elasticsearch not reachable at startup; continuing with PostgreSQL live queries.");
        }
    }

    @Scheduled(fixedDelayString = "${elasticsearch.sync-interval-ms:30000}")
    public void scheduledDeltaSync() {
        if (!esGateway.isEnabled() || !esGateway.isHealthy()) return;
        try {
            syncAllFromDatabase();
        } catch (Exception ex) {
            log.debug("Scheduled ES sync skipped: {}", ex.getMessage());
        }
    }

    @Async
    @EventListener
    public void onBookingOccupancyChanged(SlotOccupancyChangedEvent event) {
        if (!esGateway.isEnabled() || !esGateway.isHealthy()) return;
        try {
            syncAllFromDatabase();
        } catch (Exception ex) {
            log.debug("Async ES event sync failed: {}", ex.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public ReindexResponse syncAllFromDatabase() {
        long start = System.currentTimeMillis();
        boolean healthy = esGateway.isHealthy();
        if (!healthy) {
            return new ReindexResponse(
                    false, 0, 0, System.currentTimeMillis() - start,
                    "Elasticsearch chưa kết nối — hệ thống đang đọc dữ liệu trực tiếp từ PostgreSQL DB."
            );
        }

        esGateway.ensureIndicesExist();

        List<IndexDoc> courtDocs = loadCourtDocumentsFromDb();
        List<IndexDoc> bookingDocs = loadBookingDocumentsFromDb();

        int courtsIndexed = esGateway.bulkIndex(esGateway.getProperties().getCourtsIndex(), courtDocs);
        int bookingsIndexed = esGateway.bulkIndex(esGateway.getProperties().getBookingsIndex(), bookingDocs);

        long elapsed = System.currentTimeMillis() - start;
        return new ReindexResponse(
                true,
                bookingsIndexed,
                courtsIndexed,
                elapsed,
                String.format("Đã đồng bộ %d đơn đặt sân & %d cụm sân từ PostgreSQL sang Elasticsearch trong %dms.",
                        bookingsIndexed, courtsIndexed, elapsed)
        );
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse getDashboardAnalytics(String scope, UUID tenantId, int days) {
        int clampedDays = Math.min(30, Math.max(3, days));
        long t0 = System.currentTimeMillis();

        return queryAnalyticsFromPostgres(scope, tenantId, clampedDays, t0);
    }

    @Transactional(readOnly = true)
    public CourtSearchResponse searchCourts(String query, String sportCode, UUID tenantId) {
        long t0 = System.currentTimeMillis();
        String cleanQuery = query != null ? query.trim() : "";
        String cleanSport = (sportCode != null && !sportCode.isBlank() && !"ALL".equalsIgnoreCase(sportCode))
                ? sportCode.trim().toUpperCase(Locale.ROOT)
                : null;

        if (esGateway.isEnabled() && esGateway.isHealthy()) {
            CourtSearchResponse esHits = queryCourtsFromElasticsearch(cleanQuery, cleanSport, tenantId, t0);
            if (esHits != null) return esHits;
        }

        return queryCourtsFromPostgres(cleanQuery, cleanSport, tenantId, t0);
    }

    // ---------------------------------------------------------------------------------
    // ELASTICSEARCH AGGREGATION QUERIES
    // ---------------------------------------------------------------------------------
    private CourtSearchResponse queryCourtsFromElasticsearch(
            String query, String sportCode, UUID tenantId, long startMs
    ) {
        List<Map<String, Object>> filters = new ArrayList<>();
        filters.add(Map.of("term", Map.of("publishStatus", "PUBLISHED")));
        if (sportCode != null) {
            filters.add(Map.of("term", Map.of("sportCode", sportCode)));
        }
        if (tenantId != null) {
            filters.add(Map.of("term", Map.of("tenantId", tenantId.toString())));
        }

        Map<String, Object> boolQuery = new LinkedHashMap<>();
        boolQuery.put("filter", filters);
        if (!query.isBlank()) {
            boolQuery.put("must", List.of(Map.of(
                    "multi_match", Map.of(
                            "query", query,
                            "fields", List.of("groupName^3", "venueName^2", "venueAddress", "sportName", "sportCode"),
                            "fuzziness", "AUTO"
                    )
            )));
        }

        Map<String, Object> dsl = Map.of(
                "size", 50,
                "query", Map.of("bool", boolQuery)
        );

        JsonNode root = esGateway.searchIndex(esGateway.getProperties().getCourtsIndex(), dsl);
        if (root == null || root.path("hits").isMissingNode()) return null;

        List<CourtSearchResultDto> results = new ArrayList<>();
        for (JsonNode hit : root.path("hits").path("hits")) {
            JsonNode src = hit.path("_source");
            results.add(new CourtSearchResultDto(
                    UUID.fromString(src.path("groupId").asText()),
                    src.path("groupCode").asText(),
                    src.path("groupName").asText(),
                    UUID.fromString(src.path("tenantId").asText()),
                    src.path("venueName").asText(),
                    src.path("venueAddress").asText(),
                    src.path("sportCode").asText(),
                    src.path("sportName").asText(),
                    src.path("basePrice").asLong(),
                    src.path("minPrice").asLong(),
                    src.path("maxPrice").asLong(),
                    (short) src.path("depositPercent").asInt(35),
                    src.path("slotMinutes").asInt(60),
                    hit.path("_score").isNull() ? 1.0 : hit.path("_score").asDouble(1.0)
            ));
        }

        return new CourtSearchResponse(
                "ELASTICSEARCH_CQRS",
                Math.max(1, System.currentTimeMillis() - startMs),
                root.path("hits").path("total").path("value").asLong(results.size()),
                results
        );
    }

    // ---------------------------------------------------------------------------------
    // POSTGRESQL DB DIRECT ANALYTICS & SEARCH QUERIES
    // ---------------------------------------------------------------------------------
    private AnalyticsDashboardResponse queryAnalyticsFromPostgres(
            String scope, UUID tenantId, int days, long startMs
    ) {
        LocalDate today = LocalDate.now(VN_ZONE);
        Timestamp from = Timestamp.from(today.minusDays(days - 1).atStartOfDay(VN_ZONE).toInstant());
        Timestamp until = Timestamp.from(today.plusDays(1).atStartOfDay(VN_ZONE).toInstant());
        List<Object> params = new ArrayList<>(List.of(from, until));
        String tenantClause = tenantId != null ? " AND r.tenant_id = ? " : "";
        if (tenantId != null) params.add(tenantId);

        String sql = """
            SELECT
                r.id, r.slot_start, r.tenant_id, r.group_id, r.status,
                r.locked_price,
                COALESCE(p.provider, '—') AS payment_provider,
                COALESCE(p.amount, 0) AS paid_amount,
                st.name AS sport_name
            FROM reservations r
            JOIN resource_groups rg ON r.group_id = rg.id
            JOIN sport_types st ON rg.sport_type_id = st.id
            LEFT JOIN LATERAL (
                SELECT (array_agg(provider ORDER BY gateway_verified_at DESC))[1] AS provider, sum(amount) AS amount
                FROM payments WHERE booking_id = r.booking_id AND status = 'SUCCESS'
                    AND gateway_verified_at IS NOT NULL AND payment_type IN ('DEPOSIT', 'FULL_SETTLEMENT')
            ) p ON true
            WHERE r.slot_start >= ? AND r.slot_start < ?
                AND r.status IN ('CONFIRMED', 'COMPLETED')
                AND COALESCE(r.pricing_audit->>'source', '') <> 'SEED_V10'
            """ + tenantClause;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());

        long grossRevenue = 0;
        long escrowHeld = 0;
        int pendingCheckins = 0;

        Map<LocalDate, long[]> dailyAgg = new LinkedHashMap<>();
        for (int i = days - 1; i >= 0; i--) {
            dailyAgg.put(LocalDate.now(VN_ZONE).minusDays(i), new long[]{0L, 0L});
        }
        Map<Integer, List<Long>> hourlyPrices = new TreeMap<>();
        Map<String, Long> channelSums = new LinkedHashMap<>();
        Map<String, Long> sportSums = new LinkedHashMap<>();
        Map<UUID, Long> revByGroup = new HashMap<>();
        Map<UUID, Integer> countByGroup = new HashMap<>();

        for (Map<String, Object> row : rows) {
            String status = String.valueOf(row.get("status"));
            long lockedPrice = ((Number) row.get("locked_price")).longValue();
            long paidAmt = ((Number) row.get("paid_amount")).longValue();
            Instant slotStart = ((Timestamp) row.get("slot_start")).toInstant();
            UUID groupId = (UUID) row.get("group_id");
            String provider = String.valueOf(row.get("payment_provider"));
            String sportName = String.valueOf(row.get("sport_name"));

            grossRevenue += lockedPrice;
            if ("CONFIRMED".equals(status)) {
                escrowHeld += paidAmt;
                pendingCheckins++;
            }

            LocalDate date = slotStart.atZone(VN_ZONE).toLocalDate();
            if (dailyAgg.containsKey(date)) {
                dailyAgg.get(date)[0] += lockedPrice;
                dailyAgg.get(date)[1] += 1;
            }

            int hour = slotStart.atZone(VN_ZONE).getHour();
            hourlyPrices.computeIfAbsent(hour, k -> new ArrayList<>()).add(lockedPrice);

            if (paidAmt > 0) channelSums.merge(formatChannelName(provider), paidAmt, Long::sum);
            sportSums.merge(sportName, lockedPrice, Long::sum);
            revByGroup.merge(groupId, lockedPrice, Long::sum);
            countByGroup.merge(groupId, 1, Integer::sum);
        }

        Map<LocalDate, Capacity> capacityByDate = new HashMap<>();
        Map<Integer, Capacity> capacityByHour = new TreeMap<>();
        Map<UUID, Capacity> capacityByGroup = new HashMap<>();
        String capacitySql = """
            SELECT si.group_id, (si.slot_start AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
                   extract(hour FROM si.slot_start AT TIME ZONE 'Asia/Ho_Chi_Minh') AS hour,
                   sum(si.total_capacity) AS capacity, sum(coalesce(usage.count, 0)) AS booked
            FROM slot_inventory si
            LEFT JOIN LATERAL (
                SELECT count(*) AS count FROM reservations r
                WHERE r.group_id = si.group_id AND r.slot_start = si.slot_start
                    AND r.status IN ('CONFIRMED', 'COMPLETED')
                    AND COALESCE(r.pricing_audit->>'source', '') <> 'SEED_V10'
            ) usage ON true
            WHERE si.slot_start >= ? AND si.slot_start < ?
            """ + (tenantId == null ? "" : " AND si.tenant_id = ? ") + " GROUP BY 1, 2, 3";
        jdbcTemplate.query(capacitySql, rs -> {
            Capacity use = new Capacity(rs.getLong("booked"), rs.getLong("capacity"));
            capacityByDate.merge(rs.getObject("day", LocalDate.class), use, Capacity::add);
            capacityByHour.merge(rs.getInt("hour"), use, Capacity::add);
            capacityByGroup.merge(rs.getObject("group_id", UUID.class), use, Capacity::add);
        }, params.toArray());
        List<DailyRevenuePointDto> dailyList = new ArrayList<>();
        for (Map.Entry<LocalDate, long[]> e : dailyAgg.entrySet()) {
            LocalDate d = e.getKey();
            long rev = e.getValue()[0];
            int cnt = (int) e.getValue()[1];
            int occ = capacityByDate.getOrDefault(d, Capacity.EMPTY).percentage();
            String label = d.equals(today) ? "Hôm nay" : d.format(SHORT_DATE);
            dailyList.add(new DailyRevenuePointDto(
                    d.toString(), label, d.format(LABEL_DATE), rev, 0L, cnt, occ
            ));
        }

        List<HourlyOccupancyPointDto> hourlyList = new ArrayList<>();
        for (var entry : capacityByHour.entrySet()) {
            int hr = entry.getKey();
            long avgP = Math.round(hourlyPrices.getOrDefault(hr, List.of()).stream()
                    .mapToLong(Long::longValue).average().orElse(0));
            String tier = hr >= 17 && hr <= 21 ? "GIỜ VÀNG" : hr < 12 ? "THẤP ĐIỂM" : "TIÊU CHUẨN";
            hourlyList.add(new HourlyOccupancyPointDto(
                    String.format("%02dh", hr), entry.getValue().percentage(), avgP, tier));
        }

        boolean isPlatform = "PLATFORM".equalsIgnoreCase(scope);
        List<ChannelBreakdownDto> breakdown = toBreakdownDtos(isPlatform ? sportSums : channelSums);
        List<CourtPerformanceDto> courtPerf = loadCourtPerformanceFromDb(tenantId, revByGroup, countByGroup, capacityByGroup);
        List<LessorOrderSummaryDto> recentOrders = tenantId == null ? List.of() : loadRecentOrdersFromDb(tenantId, 0, 25);

        String ledgerSql = """
            SELECT le.account_code, sum(CASE le.direction WHEN 'CREDIT' THEN le.amount ELSE -le.amount END) AS balance
            FROM ledger_entries le JOIN ledger_journals lj ON lj.id = le.journal_id
            WHERE le.occurred_at >= ? AND le.occurred_at < ?
                AND left(lj.idempotency_key, 13) <> 'SEED_V10_JRN_'
                AND le.account_code IN ('PLATFORM_COMMISSION_REVENUE', 'VENUE_PAYABLE')
            """ + (tenantId == null ? "" : " AND le.tenant_id = ? ") + " GROUP BY le.account_code";
        Map<String, Long> bookedLedger = new HashMap<>();
        jdbcTemplate.query(ledgerSql, rs -> {
            bookedLedger.put(rs.getString("account_code"), rs.getLong("balance"));
        }, params.toArray());
        long commission = bookedLedger.getOrDefault("PLATFORM_COMMISSION_REVENUE", 0L);
        int avgOcc = capacityByHour.values().stream().reduce(Capacity.EMPTY, Capacity::add).percentage();

        return new AnalyticsDashboardResponse(
                scope,
                tenantId,
                "POSTGRESQL_DB",
                Math.max(1, System.currentTimeMillis() - startMs),
                rows.size(),
                grossRevenue,
                escrowHeld,
                commission,
                Math.max(0, bookedLedger.getOrDefault("VENUE_PAYABLE", 0L)),
                rows.size(),
                pendingCheckins,
                avgOcc,
                dailyList,
                hourlyList,
                breakdown,
                courtPerf,
                recentOrders
        );
    }

    private record Capacity(long booked, long total) {
        private static final Capacity EMPTY = new Capacity(0, 0);

        Capacity add(Capacity other) {
            return new Capacity(booked + other.booked, total + other.total);
        }

        int percentage() {
            return total == 0 ? 0 : Math.min(100, (int) Math.round(100.0 * booked / total));
        }
    }

    private CourtSearchResponse queryCourtsFromPostgres(
            String query, String sportCode, UUID tenantId, long startMs
    ) {
        StringBuilder sql = new StringBuilder("""
            SELECT rg.id AS group_id, rg.code AS group_code, rg.name AS group_name,
                   t.id AS tenant_id, t.name AS venue_name, COALESCE(t.address, '') AS venue_address,
                   st.code AS sport_code, st.name AS sport_name,
                   rg.base_price, rg.min_price, rg.max_price, rg.deposit_percent, rg.slot_minutes
            FROM resource_groups rg
            JOIN tenants t ON rg.tenant_id = t.id
            JOIN sport_types st ON rg.sport_type_id = st.id
            WHERE rg.publish_status = 'PUBLISHED' AND rg.status = 'ACTIVE' AND t.status = 'ACTIVE'
            """);
        List<Object> params = new ArrayList<>();
        if (sportCode != null) {
            sql.append(" AND st.code = ? ");
            params.add(sportCode);
        }
        if (tenantId != null) {
            sql.append(" AND t.id = ? ");
            params.add(tenantId);
        }
        if (!query.isBlank()) {
            String like = "%" + query.toLowerCase(Locale.ROOT) + "%";
            sql.append(" AND (LOWER(rg.name) LIKE ? OR LOWER(t.name) LIKE ? OR LOWER(COALESCE(t.address, '')) LIKE ?) ");
            params.add(like);
            params.add(like);
            params.add(like);
        }
        sql.append(" ORDER BY rg.name ASC LIMIT 50 ");

        List<CourtSearchResultDto> hits = jdbcTemplate.query(sql.toString(), (rs, i) -> new CourtSearchResultDto(
                UUID.fromString(rs.getString("group_id")),
                rs.getString("group_code"),
                rs.getString("group_name"),
                UUID.fromString(rs.getString("tenant_id")),
                rs.getString("venue_name"),
                rs.getString("venue_address"),
                rs.getString("sport_code"),
                rs.getString("sport_name"),
                rs.getLong("base_price"),
                rs.getLong("min_price"),
                rs.getLong("max_price"),
                rs.getShort("deposit_percent"),
                rs.getInt("slot_minutes"),
                1.0
        ), params.toArray());

        return new CourtSearchResponse(
                "POSTGRESQL_DB",
                Math.max(1, System.currentTimeMillis() - startMs),
                hits.size(),
                hits
        );
    }

    // ---------------------------------------------------------------------------------
    // DB DOCUMENT EXTRACTORS & MAPPING HELPERS
    // ---------------------------------------------------------------------------------
    private List<IndexDoc> loadCourtDocumentsFromDb() {
        String sql = """
            SELECT rg.id AS group_id, rg.code AS group_code, rg.name AS group_name,
                   rg.tenant_id, t.name AS venue_name, COALESCE(t.address, '') AS venue_address,
                   st.code AS sport_code, st.name AS sport_name, rg.publish_status,
                   rg.base_price, rg.min_price, rg.max_price, rg.deposit_percent, rg.slot_minutes
            FROM resource_groups rg
            JOIN tenants t ON rg.tenant_id = t.id
            JOIN sport_types st ON rg.sport_type_id = st.id
            WHERE rg.status = 'ACTIVE'
            """;
        return jdbcTemplate.query(sql, (rs, i) -> {
            String id = rs.getString("group_id");
            Map<String, Object> doc = new LinkedHashMap<>();
            doc.put("groupId", id);
            doc.put("groupCode", rs.getString("group_code"));
            doc.put("groupName", rs.getString("group_name"));
            doc.put("tenantId", rs.getString("tenant_id"));
            doc.put("venueName", rs.getString("venue_name"));
            doc.put("venueAddress", rs.getString("venue_address"));
            doc.put("sportCode", rs.getString("sport_code"));
            doc.put("sportName", rs.getString("sport_name"));
            doc.put("publishStatus", rs.getString("publish_status"));
            doc.put("basePrice", rs.getLong("base_price"));
            doc.put("minPrice", rs.getLong("min_price"));
            doc.put("maxPrice", rs.getLong("max_price"));
            doc.put("depositPercent", rs.getInt("deposit_percent"));
            doc.put("slotMinutes", rs.getInt("slot_minutes"));
            return new IndexDoc(id, doc);
        });
    }

    private List<IndexDoc> loadBookingDocumentsFromDb() {
        String sql = """
            SELECT r.id AS res_id, r.tenant_id, r.group_id, rg.name AS group_name,
                   t.name AS venue_name, st.code AS sport_code, st.name AS sport_name,
                   r.status, COALESCE(p.provider, '—') AS payment_provider,
                   r.slot_start, r.locked_price, r.deposit_amount,
                   COALESCE(p.amount, 0) AS paid_amount
            FROM reservations r
            JOIN resource_groups rg ON r.group_id = rg.id
            JOIN tenants t ON r.tenant_id = t.id
            JOIN sport_types st ON rg.sport_type_id = st.id
            LEFT JOIN payments p ON p.booking_id = r.booking_id AND p.status = 'SUCCESS'
                AND p.gateway_verified_at IS NOT NULL AND p.payment_type IN ('DEPOSIT', 'FULL_SETTLEMENT')
            """;
        return jdbcTemplate.query(sql, (rs, i) -> {
            String id = rs.getString("res_id");
            Instant slotStart = rs.getTimestamp("slot_start").toInstant();
            long lockedPrice = rs.getLong("locked_price");
            long paidAmt = rs.getLong("paid_amount");

            Map<String, Object> doc = new LinkedHashMap<>();
            doc.put("reservationId", id);
            doc.put("tenantId", rs.getString("tenant_id"));
            doc.put("groupId", rs.getString("group_id"));
            doc.put("groupName", rs.getString("group_name"));
            doc.put("venueName", rs.getString("venue_name"));
            doc.put("sportCode", rs.getString("sport_code"));
            doc.put("sportName", rs.getString("sport_name"));
            doc.put("status", rs.getString("status"));
            doc.put("paymentProvider", rs.getString("payment_provider"));
            doc.put("slotStart", slotStart.toString());
            doc.put("slotHour", slotStart.atZone(VN_ZONE).getHour());
            doc.put("lockedPrice", lockedPrice);
            doc.put("depositAmount", rs.getLong("deposit_amount"));
            doc.put("paidAmount", paidAmt);
            return new IndexDoc(id, doc);
        });
    }

    private List<CourtPerformanceDto> loadCourtPerformanceFromDb(
            UUID tenantId, Map<UUID, Long> revByGroup, Map<UUID, Integer> countByGroup,
            Map<UUID, Capacity> capacityByGroup
    ) {
        String sql = """
            SELECT rg.id, rg.name, st.code AS sport_code, st.name AS sport_name, rg.base_price
            FROM resource_groups rg
            JOIN sport_types st ON rg.sport_type_id = st.id
            WHERE rg.status = 'ACTIVE'
            """ + (tenantId != null ? " AND rg.tenant_id = ? " : "") + """
            ORDER BY rg.name ASC
            """;

        Object[] args = tenantId != null ? new Object[]{tenantId} : new Object[]{};
        return jdbcTemplate.query(sql, (rs, idx) -> {
            UUID gid = UUID.fromString(rs.getString("id"));
            int bookingsCount = countByGroup.getOrDefault(gid, 0);
            int occPct = capacityByGroup.getOrDefault(gid, Capacity.EMPTY).percentage();
            return new CourtPerformanceDto(
                    gid,
                    rs.getString("name"),
                    rs.getString("sport_code"),
                    rs.getString("sport_name"),
                    rs.getLong("base_price"),
                    bookingsCount,
                    occPct,
                    revByGroup.getOrDefault(gid, 0L)
            );
        }, args);
    }

    @Transactional(readOnly = true)
    public List<LessorOrderSummaryDto> loadRecentOrdersFromDb(UUID tenantId, int page, int size) {
        var bounds = CommonTextAndPageUtils.boundedPageable(page, size, 100);
        String sql = """
            SELECT r.id AS res_id, r.group_id, rg.name AS group_name, t.name AS venue_name,
                   st.name AS sport_name, u.unit_number, r.slot_start, ts.slot_end, r.status, r.created_at,
                   r.locked_price, r.deposit_amount,
                   COALESCE(b.contact_name, 'Khách đặt sân') AS customer_name,
                   COALESCE(b.contact_phone, '') AS customer_phone,
                   COALESCE(p.provider, '—') AS payment_provider,
                   COALESCE(p.amount, 0) AS paid_amt
            FROM reservations r
            JOIN resource_groups rg ON r.group_id = rg.id
            JOIN tenants t ON r.tenant_id = t.id
            JOIN sport_types st ON rg.sport_type_id = st.id
            JOIN units u ON r.unit_id = u.id
            LEFT JOIN time_slots ts ON ts.group_id = r.group_id AND ts.slot_start = r.slot_start
            LEFT JOIN bookings b ON r.booking_id = b.id
            LEFT JOIN LATERAL (
                SELECT (array_agg(provider ORDER BY gateway_verified_at DESC))[1] AS provider, sum(amount) AS amount
                FROM payments WHERE booking_id = r.booking_id AND status = 'SUCCESS'
                    AND gateway_verified_at IS NOT NULL AND payment_type IN ('DEPOSIT', 'FULL_SETTLEMENT')
            ) p ON true
            WHERE r.tenant_id = ? AND COALESCE(r.pricing_audit->>'source', '') <> 'SEED_V10'
            ORDER BY r.slot_start DESC, r.id DESC
            LIMIT ? OFFSET ?
            """;

        Object[] args = {tenantId, bounds.getPageSize(), bounds.getOffset()};
        return jdbcTemplate.query(sql, (rs, i) -> {
            UUID resId = UUID.fromString(rs.getString("res_id"));
            long lockedPrice = rs.getLong("locked_price");
            long paidAmt = rs.getLong("paid_amt");
            Instant slotStart = rs.getTimestamp("slot_start").toInstant();
            String slotLabel = slotStart.atZone(VN_ZONE).format(DateTimeFormatter.ofPattern("dd/MM HH:mm"));

            return new LessorOrderSummaryDto(
                    "ORD-" + resId.toString().substring(0, 8).toUpperCase(Locale.ROOT),
                    resId,
                    UUID.fromString(rs.getString("group_id")),
                    rs.getString("group_name"),
                    rs.getString("venue_name"),
                    rs.getString("sport_name"),
                    rs.getString("unit_number"),
                    slotLabel,
                    rs.getString("customer_name"),
                    rs.getString("customer_phone"),
                    lockedPrice,
                    paidAmt,
                    Math.max(0L, lockedPrice - paidAmt),
                    formatChannelName(rs.getString("payment_provider")),
                    rs.getString("status"),
                    rs.getTimestamp("created_at").toInstant().atZone(VN_ZONE).format(DateTimeFormatter.ofPattern("dd/MM HH:mm")),
                    slotStart, rs.getTimestamp("slot_end") == null ? null : rs.getTimestamp("slot_end").toInstant()
            );
        }, args);
    }

    private List<ChannelBreakdownDto> toBreakdownDtos(Map<String, Long> totals) {
        String[] palette = {"#16422C", "#0E4F7E", "#84CC16", "#F59E0B", "#64748B"};
        long grand = totals.values().stream().mapToLong(Long::longValue).sum();
        if (grand <= 0) grand = 1;

        List<ChannelBreakdownDto> result = new ArrayList<>();
        int idx = 0;
        for (Map.Entry<String, Long> e : totals.entrySet()) {
            int pct = (int) Math.round((e.getValue() * 100.0) / grand);
            result.add(new ChannelBreakdownDto(e.getKey(), Math.max(1, pct), e.getValue(), palette[idx % palette.length]));
            idx++;
        }
        return result;
    }

    private String formatChannelName(String code) {
        return switch (code) {
            case "VNPAY_ESCROW", "VNPAY" -> "VNPAY Ký quỹ";
            case "MOMO_WALLET", "MOMO" -> "Ví MoMo";
            case "INTL_CARD" -> "Thẻ Quốc tế 3DS";
            case "VIETQR_NAPAS", "VIETQR" -> "VietQR Napas 247";
            default -> "Chưa có xác nhận thanh toán online";
        };
    }
}

