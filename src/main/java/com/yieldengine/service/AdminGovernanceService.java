package com.yieldengine.service;

import com.yieldengine.entity.Tenant;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.record.admin.*;
import com.yieldengine.record.auth.RoleAssignmentDto;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminGovernanceService {

    private final JdbcTemplate jdbcTemplate;
    private final TenantRepository tenantRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<AdminTenantOverviewDto> listTenantOverviews() {
        String sql = """
            SELECT
                t.id,
                t.code,
                t.name,
                COALESCE(t.address, '') AS address,
                COALESCE(t.phone, '') AS phone,
                t.checkin_mode,
                t.is_staff_chat_enabled,
                t.status,
                t.created_at,
                (SELECT COUNT(*) FROM resource_groups rg WHERE rg.tenant_id = t.id) AS group_count,
                (SELECT COUNT(*) FROM resource_groups rg WHERE rg.tenant_id = t.id AND rg.publish_status = 'PUBLISHED') AS published_count,
                (SELECT COUNT(*) FROM units u WHERE u.tenant_id = t.id AND u.status = 'ACTIVE') AS unit_count,
                (SELECT COUNT(*) FROM reservations r WHERE r.tenant_id = t.id AND r.status NOT IN ('CANCELLED', 'EXPIRED')) AS reservation_count,
                COALESCE((SELECT SUM(r.locked_price) FROM reservations r WHERE r.tenant_id = t.id AND r.status NOT IN ('CANCELLED', 'EXPIRED')), 0) AS gross_revenue,
                COALESCE((
                    SELECT cr.rate_percent
                    FROM commission_rules cr
                    WHERE cr.status = 'ACTIVE'
                      AND (cr.tenant_id = t.id OR cr.tenant_id IS NULL)
                      AND cr.effective_period @> NOW()
                    ORDER BY (cr.tenant_id IS NOT NULL) DESC, cr.created_at DESC
                    LIMIT 1
                ), 10.00) AS commission_rate
            FROM tenants t
            ORDER BY t.created_at ASC
            """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> new AdminTenantOverviewDto(
                rs.getObject("id", UUID.class),
                rs.getString("code"),
                rs.getString("name"),
                rs.getString("address"),
                rs.getString("phone"),
                rs.getString("checkin_mode"),
                rs.getBoolean("is_staff_chat_enabled"),
                rs.getString("status"),
                toInstant(rs.getTimestamp("created_at")),
                rs.getInt("group_count"),
                rs.getInt("published_count"),
                rs.getLong("unit_count"),
                rs.getLong("reservation_count"),
                rs.getLong("gross_revenue"),
                rs.getDouble("commission_rate")
        ));
    }

    @Transactional
    public AdminTenantOverviewDto updateTenantStatus(UUID tenantId, String requestedStatus, SessionPrincipal admin) {
        String normalized = requestedStatus == null ? "" : requestedStatus.trim().toUpperCase(Locale.ROOT);
        if (!"ACTIVE".equals(normalized) && !"SUSPEND".equals(normalized)) {
            throw new IllegalArgumentException("Tenant status must be ACTIVE or SUSPEND");
        }
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found: " + tenantId));
        String previous = tenant.getStatus();
        tenant.setStatus(normalized);
        tenantRepository.save(tenant);

        auditLogService.record(
                admin.userId(),
                admin.primaryRoleCode(),
                tenantId,
                "TENANT_STATUS_CHANGED",
                "TENANT",
                tenantId.toString(),
                Map.of("oldStatus", previous, "newStatus", normalized, "code", tenant.getCode())
        );

        return listTenantOverviews().stream()
                .filter(t -> t.id().equals(tenantId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found after update: " + tenantId));
    }

    @Transactional(readOnly = true)
    public List<AdminVenueGroupDto> listVenueGroups(UUID tenantId) {
        List<Object> params = new ArrayList<>();
        String whereClause = "";
        if (tenantId != null) {
            whereClause = " WHERE rg.tenant_id = ? ";
            params.add(tenantId);
        }

        String sql = """
            SELECT
                rg.id AS group_id,
                rg.tenant_id,
                t.name AS tenant_name,
                rg.code,
                rg.name,
                COALESCE(st.code, 'OTHER') AS sport_code,
                COALESCE(st.name, 'Khác') AS sport_name,
                rg.base_price,
                rg.min_price,
                rg.max_price,
                rg.deposit_percent,
                rg.slot_minutes,
                rg.publish_status,
                (SELECT COUNT(*) FROM units u WHERE u.group_id = rg.id AND u.status = 'ACTIVE') AS unit_count,
                (SELECT COUNT(*) FROM reservations r WHERE r.group_id = rg.id AND r.status NOT IN ('CANCELLED', 'EXPIRED')) AS reservation_count
            FROM resource_groups rg
            JOIN tenants t ON t.id = rg.tenant_id
            LEFT JOIN sport_types st ON st.id = rg.sport_type_id
            """ + whereClause + " ORDER BY t.name ASC, rg.name ASC";

        return jdbcTemplate.query(sql, (rs, rowNum) -> new AdminVenueGroupDto(
                rs.getObject("group_id", UUID.class),
                rs.getObject("tenant_id", UUID.class),
                rs.getString("tenant_name"),
                rs.getString("code"),
                rs.getString("name"),
                rs.getString("sport_code"),
                rs.getString("sport_name"),
                rs.getLong("base_price"),
                rs.getLong("min_price"),
                rs.getLong("max_price"),
                rs.getShort("deposit_percent"),
                rs.getInt("slot_minutes"),
                rs.getString("publish_status"),
                rs.getLong("unit_count"),
                rs.getLong("reservation_count")
        ), params.toArray());
    }

    @Transactional(readOnly = true)
    public List<AdminUserAccountDto> listUsers(String query, String statusFilter) {
        StringBuilder sql = new StringBuilder("""
            SELECT
                u.id,
                u.username,
                u.email,
                TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS full_name,
                COALESCE(u.phone, '') AS phone,
                u.status,
                u.failed_login_attempts,
                u.locked_until,
                u.last_login_at,
                u.created_at
            FROM users u
            WHERE 1=1
            """);

        List<Object> params = new ArrayList<>();
        if (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter)) {
            sql.append(" AND u.status = ? ");
            params.add(statusFilter.trim().toUpperCase(Locale.ROOT));
        }
        if (query != null && !query.isBlank()) {
            sql.append(" AND (u.username ILIKE ? OR u.email ILIKE ? OR u.first_name ILIKE ? OR u.last_name ILIKE ?) ");
            String like = "%" + query.trim() + "%";
            params.add(like);
            params.add(like);
            params.add(like);
            params.add(like);
        }
        sql.append(" ORDER BY u.created_at DESC LIMIT 200");

        Map<UUID, List<RoleAssignmentDto>> rolesByUser = loadAllActiveUserRoles();

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
            UUID userId = rs.getObject("id", UUID.class);
            return new AdminUserAccountDto(
                    userId,
                    rs.getString("username"),
                    rs.getString("email"),
                    rs.getString("full_name"),
                    rs.getString("phone"),
                    rs.getString("status"),
                    rs.getShort("failed_login_attempts"),
                    toInstant(rs.getTimestamp("locked_until")),
                    toInstant(rs.getTimestamp("last_login_at")),
                    toInstant(rs.getTimestamp("created_at")),
                    rolesByUser.getOrDefault(userId, List.of())
            );
        }, params.toArray());
    }

    private Map<UUID, List<RoleAssignmentDto>> loadAllActiveUserRoles() {
        String sql = """
            SELECT ur.user_id, r.code AS role_code, ur.role_scope, ur.tenant_id
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.revoked_at IS NULL
            ORDER BY r.id ASC
            """;
        Map<UUID, List<RoleAssignmentDto>> map = new HashMap<>();
        jdbcTemplate.query(sql, (rs) -> {
            UUID userId = rs.getObject("user_id", UUID.class);
            map.computeIfAbsent(userId, k -> new ArrayList<>())
                    .add(new RoleAssignmentDto(
                            rs.getString("role_code"),
                            rs.getString("role_scope"),
                            rs.getObject("tenant_id", UUID.class)
                    ));
        });
        return map;
    }

    @Transactional(readOnly = true)
    public AdminRbacMatrixResponse getRbacMatrix() {
        List<AdminPermissionDto> permissions = jdbcTemplate.query(
                "SELECT code, description FROM permissions ORDER BY code ASC",
                (rs, rowNum) -> new AdminPermissionDto(rs.getString("code"), rs.getString("description"))
        );

        String roleSql = """
            SELECT
                r.id,
                r.code,
                r.name,
                r.scope,
                (SELECT COUNT(DISTINCT ur.user_id) FROM user_roles ur WHERE ur.role_id = r.id AND ur.revoked_at IS NULL) AS user_count
            FROM roles r
            ORDER BY r.id ASC
            """;

        Map<Short, List<String>> permsByRole = new HashMap<>();
        jdbcTemplate.query("""
            SELECT rp.role_id, p.code
            FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
            ORDER BY p.code ASC
            """, (rs) -> {
            short roleId = rs.getShort("role_id");
            permsByRole.computeIfAbsent(roleId, k -> new ArrayList<>()).add(rs.getString("code"));
        });

        List<AdminRoleSummaryDto> roles = jdbcTemplate.query(roleSql, (rs, rowNum) -> {
            short id = rs.getShort("id");
            return new AdminRoleSummaryDto(
                    id,
                    rs.getString("code"),
                    rs.getString("name"),
                    rs.getString("scope"),
                    rs.getLong("user_count"),
                    permsByRole.getOrDefault(id, List.of())
            );
        });

        return new AdminRbacMatrixResponse(permissions, roles);
    }

    @Transactional(readOnly = true)
    public List<AdminCommissionRuleDto> listCommissionRules() {
        String sql = """
            SELECT
                cr.id,
                cr.tenant_id,
                COALESCE(t.name, 'Mặc định Toàn sàn') AS tenant_name,
                cr.sport_type_id,
                COALESCE(st.name, 'Tất cả bộ môn') AS sport_name,
                cr.rate_percent,
                cr.commission_basis,
                cr.applies_to_forfeit,
                cr.effective_period::text AS effective_period,
                cr.status,
                cr.created_at
            FROM commission_rules cr
            LEFT JOIN tenants t ON t.id = cr.tenant_id
            LEFT JOIN sport_types st ON st.id = cr.sport_type_id
            ORDER BY cr.created_at DESC
            """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            short rawSportId = rs.getShort("sport_type_id");
            Short sportTypeId = rs.wasNull() ? null : rawSportId;
            BigDecimal rate = rs.getBigDecimal("rate_percent");
            return new AdminCommissionRuleDto(
                    rs.getObject("id", UUID.class),
                    rs.getObject("tenant_id", UUID.class),
                    rs.getString("tenant_name"),
                    sportTypeId,
                    rs.getString("sport_name"),
                    rate,
                    rs.getString("commission_basis"),
                    rs.getBoolean("applies_to_forfeit"),
                    rs.getString("effective_period"),
                    rs.getString("status"),
                    toInstant(rs.getTimestamp("created_at"))
            );
        });
    }

    @Transactional(readOnly = true)
    public List<AdminLedgerEntryDto> listLedgerEntries(UUID tenantId, int limit) {
        int safeLimit = Math.min(200, Math.max(10, limit));
        List<Object> params = new ArrayList<>();
        String where = "";
        if (tenantId != null) {
            where = " WHERE le.tenant_id = ? ";
            params.add(tenantId);
        }
        params.add(safeLimit);

        String sql = """
            SELECT
                le.id AS entry_id,
                le.journal_id,
                le.tenant_id,
                COALESCE(t.name, 'Platform') AS tenant_name,
                le.reservation_id,
                le.account_code,
                le.entry_type,
                le.direction,
                le.amount,
                le.currency,
                le.occurred_at
            FROM ledger_entries le
            LEFT JOIN tenants t ON t.id = le.tenant_id
            """ + where + " ORDER BY le.occurred_at DESC LIMIT ?";

        return jdbcTemplate.query(sql, (rs, rowNum) -> new AdminLedgerEntryDto(
                rs.getObject("entry_id", UUID.class),
                rs.getObject("journal_id", UUID.class),
                rs.getObject("tenant_id", UUID.class),
                rs.getString("tenant_name"),
                rs.getObject("reservation_id", UUID.class),
                rs.getString("account_code"),
                rs.getString("entry_type"),
                rs.getString("direction"),
                rs.getLong("amount"),
                rs.getString("currency"),
                toInstant(rs.getTimestamp("occurred_at"))
        ), params.toArray());
    }

    @Transactional(readOnly = true)
    public List<AdminAuditLogDto> listAuditLogs(String action, UUID tenantId, int limit) {
        int safeLimit = Math.min(200, Math.max(10, limit));
        StringBuilder sql = new StringBuilder("""
            SELECT
                a.id AS audit_id,
                a.actor_user_id,
                COALESCE(u.username, 'system') AS actor_username,
                COALESCE(a.actor_role, 'SYSTEM') AS actor_role,
                a.tenant_id,
                COALESCE(t.name, 'Toàn sàn (Platform)') AS tenant_name,
                a.action,
                a.entity_type,
                a.entity_id,
                a.details::text AS details_json,
                a.created_at
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.actor_user_id
            LEFT JOIN tenants t ON t.id = a.tenant_id
            WHERE 1=1
            """);

        List<Object> params = new ArrayList<>();
        if (action != null && !action.isBlank() && !"ALL".equalsIgnoreCase(action)) {
            sql.append(" AND a.action = ? ");
            params.add(action.trim());
        }
        if (tenantId != null) {
            sql.append(" AND a.tenant_id = ? ");
            params.add(tenantId);
        }
        sql.append(" ORDER BY a.created_at DESC LIMIT ?");
        params.add(safeLimit);

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> new AdminAuditLogDto(
                rs.getObject("audit_id", UUID.class),
                rs.getObject("actor_user_id", UUID.class),
                rs.getString("actor_username"),
                rs.getString("actor_role"),
                rs.getObject("tenant_id", UUID.class),
                rs.getString("tenant_name"),
                rs.getString("action"),
                rs.getString("entity_type"),
                rs.getString("entity_id"),
                rs.getString("details_json"),
                toInstant(rs.getTimestamp("created_at"))
        ), params.toArray());
    }

    private Instant toInstant(Timestamp ts) {
        return ts != null ? ts.toInstant() : null;
    }
}

