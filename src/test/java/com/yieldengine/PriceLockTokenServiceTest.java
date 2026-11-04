package com.yieldengine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.PricingProperties;
import com.yieldengine.exception.InvalidTokenSignatureException;
import com.yieldengine.exception.TokenExpiredException;
import com.yieldengine.service.PriceLockTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("PriceLockTokenService Stateless HMAC-SHA256 Security Tests")
class PriceLockTokenServiceTest {

    private PriceLockTokenService priceLockTokenService;
    private PricingProperties pricingProperties;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        pricingProperties = new PricingProperties();
        pricingProperties.getToken().setSecretKey("VerySecretHmacSha256KeyForTestingPurposeOnly1234567890!");
        objectMapper = new ObjectMapper();
        objectMapper.findAndRegisterModules();
        priceLockTokenService = new PriceLockTokenService(pricingProperties, objectMapper);
    }

    @Test
    @DisplayName("Generate token and verify valid HMAC-SHA256 token")
    void testGenerateAndVerifyToken() {
        UUID tokenJti = UUID.randomUUID();
        UUID slotId = UUID.randomUUID();
        String userId = "user_pickle_123";
        BigDecimal lockedPrice = BigDecimal.valueOf(230_000);
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(10));

        String token = priceLockTokenService.generateToken(tokenJti, userId, slotId, lockedPrice, expiresAt);
        assertNotNull(token);
        assertTrue(token.contains("."));

        PriceLockTokenService.TokenPayload payload = priceLockTokenService.verifyAndExtract(token);
        assertEquals(tokenJti, payload.getTokenJti());
        assertEquals(userId, payload.getUserId());
        assertEquals(slotId, payload.getSlotId());
        assertEquals(lockedPrice, payload.getLockedPrice());
    }

    @Test
    @DisplayName("Tampered token payload must be rejected with InvalidTokenSignatureException")
    void testTamperedTokenFails() {
        UUID tokenJti = UUID.randomUUID();
        UUID slotId = UUID.randomUUID();
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(10));

        String token = priceLockTokenService.generateToken(tokenJti, "user_legit", slotId, BigDecimal.valueOf(300_000), expiresAt);
        String[] parts = token.split("\\.");

        // Tamper with payload (substituting a modified base64 string)
        String tamperedToken = parts[0] + "xyz." + parts[1];
        assertThrows(InvalidTokenSignatureException.class, () -> priceLockTokenService.verifyAndExtract(tamperedToken));
    }

    @Test
    @DisplayName("Expired token must throw TokenExpiredException")
    void testExpiredTokenThrowsException() {
        UUID tokenJti = UUID.randomUUID();
        UUID slotId = UUID.randomUUID();
        // Expired 5 minutes ago
        Instant expiresAt = Instant.now().minus(Duration.ofMinutes(5));

        String token = priceLockTokenService.generateToken(tokenJti, "user_late", slotId, BigDecimal.valueOf(200_000), expiresAt);
        assertThrows(TokenExpiredException.class, () -> priceLockTokenService.verifyAndExtract(token));
    }
}
