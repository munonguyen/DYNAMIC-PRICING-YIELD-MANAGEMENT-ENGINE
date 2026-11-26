package com.yieldengine.controller;

import com.yieldengine.controller.admin.AdminPlatformController;
import com.yieldengine.entity.Tenant;
import com.yieldengine.exception.ForbiddenAccessException;
import com.yieldengine.exception.UnauthorizedException;
import com.yieldengine.record.admin.AdminTenantOverviewDto;
import com.yieldengine.record.admin.AdminTenantStatusRequest;
import com.yieldengine.record.security.RoleGrant;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.repository.TenantRepository;
import com.yieldengine.security.AuthContext;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.AdminGovernanceService;
import com.yieldengine.service.AuditLogService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("AdminPlatformController RBAC & AdminGovernanceService DB Mutation Tests")
class AdminPlatformControllerAndServiceTest {

    @AfterEach
    void tearDown() {
        AuthContext.clear();
    }

    @Test
    @DisplayName("Enforces ADMIN / ACCOUNTANT platform RBAC on admin endpoints")
    void enforcesPlatformAdminAndAccountantRbac() {
        AdminGovernanceService service = mock(AdminGovernanceService.class);
        when(service.listTenantOverviews()).thenReturn(List.of());
        AdminPlatformController controller = new AdminPlatformController(service, new RbacGuard());

        // Unauthenticated
        assertThrows(UnauthorizedException.class, controller::listTenants);

        // Tenant MANAGER cannot access platform admin endpoints
        UUID tenantId = UUID.randomUUID();
        AuthContext.set(principal("MANAGER", "TENANT", tenantId), "tok_mgr");
        assertThrows(ForbiddenAccessException.class, controller::listTenants);
        assertThrows(ForbiddenAccessException.class, controller::getRbacMatrix);

        // Platform ACCOUNTANT can read tenants, ledger & RBAC matrix, but cannot toggle tenant status
        AuthContext.set(principal("ACCOUNTANT", "PLATFORM", null), "tok_acc");
        assertEquals(200, controller.listTenants().getStatusCode().value());
        assertThrows(ForbiddenAccessException.class,
                () -> controller.updateTenantStatus(tenantId, new AdminTenantStatusRequest("SUSPEND")));

        // Platform ADMIN can perform both read and status mutation
        AuthContext.set(principal("ADMIN", "PLATFORM", null), "tok_adm");
        when(service.updateTenantStatus(eq(tenantId), eq("SUSPEND"), any()))
                .thenReturn(new AdminTenantOverviewDto(
                        tenantId, "TEST", "Test Venue", "HN", "090", "QR_STAFF", true,
                        "SUSPEND", Instant.now(), 1, 1, 4L, 0L, 0L, 10.0
                ));
        var resp = controller.updateTenantStatus(tenantId, new AdminTenantStatusRequest("SUSPEND"));
        assertEquals(200, resp.getStatusCode().value());
        assertEquals("SUSPEND", resp.getBody().status());
    }

    @Test
    @DisplayName("Validates tenant status transition and writes immutable AuditLog entry")
    void updatesTenantStatusAndRecordsAuditLog() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        TenantRepository tenantRepo = mock(TenantRepository.class);
        AuditLogService auditLog = mock(AuditLogService.class);

        UUID tenantId = UUID.randomUUID();
        Tenant tenant = Tenant.builder()
                .id(tenantId)
                .code("BK_SPORT")
                .name("Bach Khoa Sport")
                .status("ACTIVE")
                .build();
        when(tenantRepo.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(tenantRepo.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        AdminTenantOverviewDto refreshed = new AdminTenantOverviewDto(
                tenantId, "BK_SPORT", "Bach Khoa Sport", "Ha Noi", "", "QR_STAFF",
                true, "SUSPEND", Instant.now(), 2, 2, 10L, 5L, 1500000L, 10.0
        );
        when(jdbc.query(anyString(), any(RowMapper.class))).thenReturn(List.of(refreshed));

        AdminGovernanceService service = new AdminGovernanceService(jdbc, tenantRepo, auditLog);
        SessionPrincipal admin = principal("ADMIN", "PLATFORM", null);

        assertThrows(IllegalArgumentException.class,
                () -> service.updateTenantStatus(tenantId, "DELETED", admin));

        AdminTenantOverviewDto result = service.updateTenantStatus(tenantId, "suspend", admin);
        assertEquals("SUSPEND", result.status());
        assertEquals("SUSPEND", tenant.getStatus());
        verify(auditLog, times(1)).record(
                eq(admin.userId()),
                eq("ADMIN"),
                eq(tenantId),
                eq("TENANT_STATUS_CHANGED"),
                eq("TENANT"),
                eq(tenantId.toString()),
                anyMap()
        );
    }

    private SessionPrincipal principal(String role, String scope, UUID tenantId) {
        return new SessionPrincipal(
                UUID.randomUUID(),
                role.toLowerCase(),
                List.of(new RoleGrant(role, scope, tenantId)),
                Instant.now(),
                Instant.now().plusSeconds(3600)
        );
    }
}

