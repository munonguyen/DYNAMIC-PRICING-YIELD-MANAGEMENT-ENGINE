package com.yieldengine.config;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.entity.Role;
import com.yieldengine.entity.User;
import com.yieldengine.entity.UserRole;
import com.yieldengine.repository.RoleRepository;
import com.yieldengine.repository.TenantRepository;
import com.yieldengine.repository.UserRepository;
import com.yieldengine.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Seeds disposable role accounts when explicitly running the local-demo profile.
 */
@Slf4j
@Component
@Profile("local-demo")
@RequiredArgsConstructor
public class DefaultAccountsSeeder implements ApplicationRunner {

    private static final UUID DEFAULT_TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;
    @Value("${ARENAPULSE_DEMO_ACCOUNT_PASSWORD}")
    private String demoPassword;

    private record SeedAccountSpec(
            String username,
            String email,
            String firstName,
            String lastName,
            String phone,
            String roleCode,
            String scope,
            UUID tenantId
    ) {}

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (demoPassword.length() < 12) {
            throw new IllegalArgumentException("ARENAPULSE_DEMO_ACCOUNT_PASSWORD must contain at least 12 characters");
        }
        String passwordHash = passwordEncoder.encode(demoPassword);
        UUID venueTenantId = tenantRepository.existsById(DEFAULT_TENANT_ID) ? DEFAULT_TENANT_ID : null;

        List<SeedAccountSpec> specs = List.of(
                new SeedAccountSpec(
                        "chusan.bachkhoa", "chusan.bachkhoa@arenapulse.vn",
                        "Trần Minh", "Đức", "0903112233",
                        SystemConstant.ROLE_MANAGER, SystemConstant.SCOPE_TENANT, venueTenantId
                ),
                new SeedAccountSpec(
                        "chusan.mydinh", "chusan.mydinh@arenapulse.vn",
                        "Nguyễn Hoàng", "Hải", "0904223344",
                        SystemConstant.ROLE_MANAGER, SystemConstant.SCOPE_TENANT, UUID.fromString("00000000-0000-0000-0000-000000000002")
                ),
                new SeedAccountSpec(
                        "chusan.westlake", "chusan.westlake@arenapulse.vn",
                        "Lê Bảo", "Ngọc", "0905334455",
                        SystemConstant.ROLE_MANAGER, SystemConstant.SCOPE_TENANT, UUID.fromString("00000000-0000-0000-0000-000000000003")
                ),
                new SeedAccountSpec(
                        "chusan.saigon", "chusan.saigon@arenapulse.vn",
                        "Phạm Quốc", "Tuấn", "0908667788",
                        SystemConstant.ROLE_MANAGER, SystemConstant.SCOPE_TENANT, UUID.fromString("00000000-0000-0000-0000-000000000004")
                ),
                new SeedAccountSpec(
                        "nhanvien.san01", "nhanvien.san01@arenapulse.vn",
                        "Vũ Tuấn", "Kiệt", "0912889900",
                        SystemConstant.ROLE_STAFF, SystemConstant.SCOPE_TENANT, venueTenantId
                ),
                new SeedAccountSpec(
                        "admin.arenapulse", "admin@arenapulse.vn",
                        "Ban Quản Trị", "ArenaPulse", "0901000999",
                        SystemConstant.ROLE_ADMIN, SystemConstant.SCOPE_PLATFORM, null
                ),
                new SeedAccountSpec(
                        "ketoan.san", "ketoan@arenapulse.vn",
                        "Đặng Thu", "Hà", "0902000888",
                        SystemConstant.ROLE_ACCOUNTANT, SystemConstant.SCOPE_PLATFORM, null
                ),
                new SeedAccountSpec(
                        "khach.thuesan", "khach.thuesan@arenapulse.vn",
                        "Nguyễn Minh", "Quân", "0988776655",
                        SystemConstant.ROLE_USER, SystemConstant.SCOPE_PLATFORM, null
                )
        );

        for (SeedAccountSpec spec : specs) {
            if (SystemConstant.SCOPE_TENANT.equals(spec.scope())
                    && (spec.tenantId() == null || !tenantRepository.existsById(spec.tenantId()))) {
                continue;
            }
            if (userRepository.existsByUsername(spec.username())) {
                continue;
            }
            Role role = roleRepository.findByCode(spec.roleCode()).orElse(null);
            if (role == null) {
                continue;
            }

            User user = User.builder()
                    .username(spec.username())
                    .email(spec.email())
                    .passwordHash(passwordHash)
                    .firstName(spec.firstName())
                    .lastName(spec.lastName())
                    .phone(spec.phone())
                    .status("ACTIVE")
                    .failedLoginAttempts((short) 0)
                    .build();
            user = userRepository.save(user);

            UserRole assignment = UserRole.builder()
                    .user(user)
                    .role(role)
                    .roleScope(spec.scope())
                    .tenantId(spec.tenantId())
                    .build();
            userRoleRepository.save(assignment);
            log.info("Seeded default {} account: {}", spec.roleCode(), spec.username());
        }
    }
}

