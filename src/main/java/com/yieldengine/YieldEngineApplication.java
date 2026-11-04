package com.yieldengine;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Dynamic Pricing & Yield Management Engine Application
 * Core Entry Point for Spring Boot 3.x Monolith
 */
@SpringBootApplication
@EnableAsync
@ConfigurationPropertiesScan
public class YieldEngineApplication {

    public static void main(String[] args) {
        SpringApplication.run(YieldEngineApplication.class, args);
    }
}
