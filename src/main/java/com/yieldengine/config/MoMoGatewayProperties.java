package com.yieldengine.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Externalized configuration properties for MoMo Vietnam PayGate v2.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "momo.gateway")
public class MoMoGatewayProperties {

    private String endpoint = "https://test-payment.momo.vn/v2/gateway/api/create";
    private String partnerCode;
    private String partnerName = "ArenaPulse";
    private String storeId = "ArenaPulseStore";
    private String accessKey;
    private String secretKey;
    private String redirectUrl = "http://127.0.0.1:5174/checkout";
    private String ipnUrl;
    private String lang = "vi";
    private String requestType = "captureWallet";
    private boolean liveHttpEnabled = true;
}

