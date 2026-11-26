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
    private String partnerCode = "MOMOBKUN20180529";
    private String partnerName = "ArenaPulse";
    private String storeId = "ArenaPulseStore";
    private String accessKey = "klm05TvNBzhg7h7j";
    private String secretKey = "at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa";
    private String redirectUrl = "http://127.0.0.1:5174/checkout";
    private String ipnUrl = "http://localhost:8080/api/v1/payments/momo/ipn";
    private String lang = "vi";
    private String requestType = "captureWallet";
    private boolean liveHttpEnabled = true;
    private boolean sandboxAutoApprove = true;
}

