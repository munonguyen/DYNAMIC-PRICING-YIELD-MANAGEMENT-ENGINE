package com.yieldengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.PricingProperties;
import com.yieldengine.exception.InvalidTokenSignatureException;
import com.yieldengine.exception.TokenExpiredException;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PriceLockTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private final PricingProperties pricingProperties;
    private final ObjectMapper objectMapper;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenPayload {
        private UUID tokenJti;
        private String userId;
        private UUID slotId;
        private BigDecimal lockedPrice;
        private Instant expiresAt;
    }

    public String generateToken(UUID tokenJti, String userId, UUID slotId, BigDecimal lockedPrice, Instant expiresAt) {
        try {
            TokenPayload payload = TokenPayload.builder()
                    .tokenJti(tokenJti)
                    .userId(userId)
                    .slotId(slotId)
                    .lockedPrice(lockedPrice)
                    .expiresAt(expiresAt)
                    .build();

            String payloadJson = objectMapper.writeValueAsString(payload);
            String encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
            String signature = sign(encodedPayload);

            return encodedPayload + "." + signature;
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate price lock token", e);
        }
    }

    public TokenPayload verifyAndExtract(String token) {
        if (token == null || !token.contains(".")) {
            throw new InvalidTokenSignatureException("Invalid token format");
        }

        String[] parts = token.split("\\.");
        if (parts.length != 2) {
            throw new InvalidTokenSignatureException("Invalid token structure");
        }

        String encodedPayload = parts[0];
        String signature = parts[1];

        // 1. Verify HMAC signature (constant-time comparison)
        String expectedSignature = sign(encodedPayload);
        if (!MessageDigest.isEqual(signature.getBytes(StandardCharsets.UTF_8), expectedSignature.getBytes(StandardCharsets.UTF_8))) {
            throw new InvalidTokenSignatureException("PriceLockToken signature verification failed");
        }

        // 2. Deserialize payload
        TokenPayload payload;
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(encodedPayload);
            payload = objectMapper.readValue(decoded, TokenPayload.class);
        } catch (Exception e) {
            throw new InvalidTokenSignatureException("Failed to parse token payload");
        }

        // 3. Verify expiration
        if (payload.getExpiresAt() == null || payload.getExpiresAt().isBefore(Instant.now())) {
            throw new TokenExpiredException("PriceLockToken has expired at: " + payload.getExpiresAt());
        }

        return payload;
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                    pricingProperties.getToken().getSecretKey().getBytes(StandardCharsets.UTF_8),
                    HMAC_ALGORITHM
            );
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hmacBytes);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new RuntimeException("Error computing HMAC signature", e);
        }
    }
}
