package com.yieldengine.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.net.URI;
import java.util.stream.Stream;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "vietqr")
public class VietQrProperties {
    public enum Mode { SANDBOX, LIVE }

    private boolean enabled;
    private Mode mode = Mode.SANDBOX;
    private String sandboxBaseUrl = "https://dev.vietqr.org";
    private String merchantUsername;
    private String merchantPassword;
    private String callbackUsername;
    private String callbackPassword;
    private String callbackSecret;
    private String bankCode;
    private String bankAccount;
    private String accountName;

    public boolean isConfigured() {
        return enabled && Stream.of(merchantUsername, merchantPassword, callbackUsername, callbackPassword,
                        callbackSecret, bankCode, bankAccount, accountName)
                .allMatch(value -> value != null && !value.isBlank())
                && callbackPassword.length() >= 16 && callbackSecret.length() >= 32
                && bankCode.matches("[A-Za-z0-9]{2,20}") && bankAccount.matches("[A-Za-z0-9]{1,40}")
                && accountName.matches("[A-Za-z0-9 .'-]{1,100}") && providerBase() != null;
    }

    public URI providerBase() {
        if (mode == Mode.LIVE) {
            return URI.create("https://api.vietqr.org");
        }
        if ("https://dev.vietqr.org".equals(sandboxBaseUrl)) {
            return URI.create(sandboxBaseUrl);
        }
        if (sandboxBaseUrl != null && sandboxBaseUrl.matches("http://127[.]0[.]0[.]1:[0-9]{1,5}")) {
            return URI.create(sandboxBaseUrl);
        }
        return null;
    }

    public boolean isSandbox() {
        return mode == Mode.SANDBOX;
    }
}
