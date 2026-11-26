package com.yieldengine.validate;

import com.yieldengine.enums.TokenPurpose;
import com.yieldengine.exception.InvalidTokenSignatureException;
import com.yieldengine.exception.TokenExpiredException;
import com.yieldengine.utils.CryptoHashUtils;

import java.time.Instant;

/**
 * Stateless cryptographic envelope, signature, purpose, and expiration validator for signed tokens.
 */
public final class TokenFormatValidator {

    private TokenFormatValidator() {
    }

    public static String validateEnvelopeAndSignature(String token, String rawSecret, TokenPurpose purpose) {
        if (token == null || !token.contains(".")) {
            throw new InvalidTokenSignatureException("Invalid token format");
        }
        String[] parts = token.split("\\.");
        if (parts.length != 2) {
            throw new InvalidTokenSignatureException("Invalid token structure");
        }

        String encodedPayload = parts[0];
        String signature = parts[1];
        String expectedSignature = CryptoHashUtils.hmacSha256Base64Url(encodedPayload, rawSecret);

        if (!CryptoHashUtils.constantTimeEquals(signature, expectedSignature)) {
            throw new InvalidTokenSignatureException(purpose + " signature verification failed");
        }
        return encodedPayload;
    }

    public static void validatePurpose(String actualPurpose, TokenPurpose expectedPurpose) {
        if (!expectedPurpose.name().equals(actualPurpose)) {
            throw new InvalidTokenSignatureException("Invalid token purpose: expected " + expectedPurpose);
        }
    }

    public static void validateNotExpired(Instant expiresAt, String tokenLabel) {
        if (expiresAt == null || expiresAt.isBefore(Instant.now())) {
            throw new TokenExpiredException(tokenLabel + " has expired at: " + expiresAt);
        }
    }
}

