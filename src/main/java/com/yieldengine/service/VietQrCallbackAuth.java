package com.yieldengine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.VietQrProperties;
import com.yieldengine.exception.UnauthorizedException;
import com.yieldengine.utils.CryptoHashUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class VietQrCallbackAuth {
    private static final long LIFETIME_SECONDS = 300;
    private static final String HEADER = CryptoHashUtils.base64UrlEncodeUtf8("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");

    private final VietQrProperties properties;
    private final ObjectMapper json;

    public Map<String, Object> issue(String authorization) {
        if (!properties.isConfigured() || authorization == null || !authorization.startsWith("Basic ")
                || authorization.length() > 4096) {
            throw unauthorized();
        }
        String expected = Base64.getEncoder().encodeToString(
                (properties.getCallbackUsername() + ":" + properties.getCallbackPassword()).getBytes(StandardCharsets.UTF_8));
        if (!CryptoHashUtils.constantTimeEquals(expected, authorization.substring(6))) {
            throw unauthorized();
        }
        long now = Instant.now().getEpochSecond();
        try {
            byte[] claims = json.writeValueAsBytes(Map.of("sub", "vietqr-transaction-sync", "mode", properties.getMode().name(),
                    "iat", now, "exp", now + LIFETIME_SECONDS, "jti", CryptoHashUtils.generateSecureUrlToken(16)));
            String body = HEADER + "." + CryptoHashUtils.base64UrlEncode(claims);
            return Map.of("access_token", body + "." + sign(body), "token_type", "Bearer", "expires_in", LIFETIME_SECONDS);
        } catch (IOException ex) {
            throw new IllegalStateException("Chưa cấp được token VietQR.");
        }
    }

    public void requireValid(String authorization) {
        if (!properties.isConfigured() || authorization == null || !authorization.startsWith("Bearer ")
                || authorization.length() > 4096) {
            throw unauthorized();
        }
        String[] parts = authorization.substring(7).split("\\.", -1);
        if (parts.length != 3 || !HEADER.equals(parts[0])
                || !CryptoHashUtils.constantTimeEquals(parts[2], sign(parts[0] + "." + parts[1]))) {
            throw unauthorized();
        }
        try {
            JsonNode claims = json.readTree(CryptoHashUtils.base64UrlDecode(parts[1]));
            long now = Instant.now().getEpochSecond();
            if ("vietqr-transaction-sync".equals(claims.path("sub").asText())
                    && properties.getMode().name().equals(claims.path("mode").asText())
                    && claims.path("iat").asLong(Long.MAX_VALUE) <= now && claims.path("exp").asLong() > now) {
                return;
            }
        } catch (IOException | IllegalArgumentException ignored) {
            // Malformed or expired credentials return the same response.
        }
        throw unauthorized();
    }

    private String sign(String body) {
        return CryptoHashUtils.hmacSha256Base64Url(body, properties.getCallbackSecret());
    }

    private UnauthorizedException unauthorized() {
        return new UnauthorizedException("Không xác thực được callback VietQR.");
    }
}
