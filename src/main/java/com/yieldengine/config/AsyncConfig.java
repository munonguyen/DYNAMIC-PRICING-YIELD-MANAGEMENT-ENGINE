package com.yieldengine.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
public class AsyncConfig {

    public static final String PRICE_RECALCULATION_EXECUTOR = "priceRecalculationExecutor";

    @Bean(name = PRICE_RECALCULATION_EXECUTOR)
    public Executor priceRecalculationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("PriceRecalc-");
        executor.initialize();
        return executor;
    }
}
