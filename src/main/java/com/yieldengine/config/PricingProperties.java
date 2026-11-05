package com.yieldengine.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "pricing")
public class PricingProperties {

    private Token token = new Token();
    private Hold hold = new Hold();
    private Cache cache = new Cache();

    @Getter
    @Setter
    public static class Token {
        private String secretKey = "DefaultSecretKeyHMACSHA256SecretValueMustBe256BitsMinimum!";
        private int ttlMinutes = 10;
    }

    @Getter
    @Setter
    public static class Hold {
        private int ttlMinutes = 10;
    }

    @Getter
    @Setter
    public static class Cache {
        private String caffeineSpec = "maximumSize=10000,expireAfterWrite=60s";
    }
}

