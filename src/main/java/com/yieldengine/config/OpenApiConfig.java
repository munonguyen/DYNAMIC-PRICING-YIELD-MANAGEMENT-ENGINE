package com.yieldengine.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Dynamic Pricing & Yield Management Engine API")
                        .version("1.0.0")
                        .description("Role-separated Spring Boot REST API for ArenaPulse Multi-Tenant Sports Marketplace.")
                        .contact(new Contact().name("Yield Management Engineering Team"))
                        .license(new License().name("Apache 2.0").url("https://springdoc.org")));
    }

    @Bean
    public GroupedOpenApi allEndpointsGroup() {
        return GroupedOpenApi.builder()
                .group("00-all-endpoints")
                .packagesToScan("com.yieldengine.controller")
                .build();
    }

    @Bean
    public GroupedOpenApi publicAndAuthGroup() {
        return GroupedOpenApi.builder()
                .group("01-public-and-auth")
                .packagesToScan("com.yieldengine.controller.auth", "com.yieldengine.controller.publicapi")
                .build();
    }

    @Bean
    public GroupedOpenApi customerUserRoleGroup() {
        return GroupedOpenApi.builder()
                .group("02-role-user-customer")
                .packagesToScan("com.yieldengine.controller.customer")
                .build();
    }

    @Bean
    public GroupedOpenApi lessorManagerRoleGroup() {
        return GroupedOpenApi.builder()
                .group("03-role-manager-lessor")
                .packagesToScan("com.yieldengine.controller.lessor")
                .build();
    }

    @Bean
    public GroupedOpenApi venueStaffRoleGroup() {
        return GroupedOpenApi.builder()
                .group("04-role-staff-checkin")
                .packagesToScan("com.yieldengine.controller.staff")
                .build();
    }

    @Bean
    public GroupedOpenApi accountantFinanceRoleGroup() {
        return GroupedOpenApi.builder()
                .group("05-role-accountant-finance")
                .packagesToScan("com.yieldengine.controller.accountant")
                .build();
    }

    @Bean
    public GroupedOpenApi platformAdminRoleGroup() {
        return GroupedOpenApi.builder()
                .group("06-role-admin-platform")
                .packagesToScan("com.yieldengine.controller.admin")
                .build();
    }
}
