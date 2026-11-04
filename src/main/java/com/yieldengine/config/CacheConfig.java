package com.yieldengine.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
@RequiredArgsConstructor
public class CacheConfig {

    public static final String CACHE_SLOT_PRICES = "slotPrices";
    public static final String CACHE_YIELD_RULES = "yieldRules";

    private final PricingProperties pricingProperties;

    @Bean
    @Primary
    public CacheManager caffeineCacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager(CACHE_SLOT_PRICES, CACHE_YIELD_RULES);
        cacheManager.setCaffeine(Caffeine.from(pricingProperties.getCache().getCaffeineSpec()));
        return cacheManager;
    }
}
