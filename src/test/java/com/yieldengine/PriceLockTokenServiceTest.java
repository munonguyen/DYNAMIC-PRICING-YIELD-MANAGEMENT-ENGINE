package com.yieldengine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.PricingProperties;
import com.yieldengine.exception.InvalidTokenSignatureException;
import com.yieldengine.exception.TokenExpiredException;
import com.yieldengine.service.PriceLockTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("PriceLockTokenService Stateless HMAC-SHA256 Security Tests (Schema V2)")
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
    @DisplayName("Generate token with kid and verify valid HMAC-SHA256 token")
    void testGenerateAndVerifyToken() {
        String kid = "KEY_2026_V1";
        UUID tokenJti = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        String userId = "user_pickle_123";
        UUID groupId = UUID.randomUUID();
        Instant slotStart = Instant.now().plus(Duration.ofHours(24));
        Long lockedPrice = 230_000L;
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(10));

        String token = priceLockTokenService.generateToken(kid, tokenJti, tenantId, userId, groupId, slotStart, lockedPrice, expiresAt);
        assertNotNull(token);
        assertTrue(token.contains("."));

        PriceLockTokenService.TokenPayload payload = priceLockTokenService.verifyAndExtract(token);
        assertEquals(kid, payload.getKid());
        assertEquals(tokenJti, payload.getTokenJti());
        assertEquals(tenantId, payload.getTenantId());
        assertEquals(userId, payload.getUserId());
        assertEquals(groupId, payload.getGroupId());
        assertEquals(slotStart, payload.getSlotStart());
        assertEquals(lockedPrice, payload.getLockedPrice());
    }

    @Test
    @DisplayName("Tampered token payload must be rejected with InvalidTokenSignatureException")
    void testTamperedTokenFails() {
        String kid = "KEY_2026_V1";
        UUID tokenJti = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID groupId = UUID.randomUUID();
        Instant slotStart = Instant.now().plus(Duration.ofHours(24));
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(10));

        String token = priceLockTokenService.generateToken(kid, tokenJti, tenantId, "user_legit", groupId, slotStart, 300_000L, expiresAt);
        String[] parts = token.split("\\.");

        // Tamper with payload (substituting a modified base64 string)
        String tamperedToken = parts[0] + "xyz." + parts[1];
        assertThrows(InvalidTokenSignatureException.class, () -> priceLockTokenService.verifyAndExtract(tamperedToken));
    }

    @Test
    @DisplayName("Expired token must throw TokenExpiredException")
    void testExpiredTokenThrowsException() {
        String kid = "KEY_2026_V1";
        UUID tokenJti = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID groupId = UUID.randomUUID();
        Instant slotStart = Instant.now().plus(Duration.ofHours(24));
        // Expired 5 minutes ago
        Instant expiresAt = Instant.now().minus(Duration.ofMinutes(5));

        String token = priceLockTokenService.generateToken(kid, tokenJti, tenantId, "user_late", groupId, slotStart, 200_000L, expiresAt);
        assertThrows(TokenExpiredException.class, () -> priceLockTokenService.verifyAndExtract(token));
    }
}
