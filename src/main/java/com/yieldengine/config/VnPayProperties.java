package com.yieldengine.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Externalized configuration properties for VNPAY Payment Gateway v2.1.0.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "vnpay")
public class VnPayProperties {

    private String payUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    private String apiUrl = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
    private String tmnCode = "ARENAPULSE";
    private String hashSecret = "VNPAY_SANDBOX_HASH_SECRET_KEY_CONFIGURE_IN_ENV";
    private String version = "2.1.0";
    private String commandPay = "pay";
    private String currCode = "VND";
    private String defaultOrderType = "other";
    private String defaultLocale = "vn";
    private String returnUrl = "http://127.0.0.1:5174/checkout";
    private String ipnUrl = "http://localhost:8080/api/v1/payments/vnpay/ipn";
    private int expireMinutes = 15;
}

