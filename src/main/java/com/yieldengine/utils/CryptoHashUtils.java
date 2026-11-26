package com.yieldengine.utils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Centralized cryptographic, hashing, Base64URL, and secure token utilities.
 */
public final class CryptoHashUtils {

    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final String HMAC_SHA512 = "HmacSHA512";
    private static final String SHA_256 = "SHA-256";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private CryptoHashUtils() {
    }

    public static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance(SHA_256);
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }

    public static String hmacSha256Hex(String data, String rawSecretKey) {
        return computeHmacHex(HMAC_SHA256, data, rawSecretKey);
    }

    public static String hmacSha512Hex(String data, String rawSecretKey) {
        return computeHmacHex(HMAC_SHA512, data, rawSecretKey);
    }

    private static String computeHmacHex(String algorithm, String data, String rawSecretKey) {
        if (data == null || rawSecretKey == null || rawSecretKey.isBlank()) {
            throw new IllegalArgumentException("Dữ liệu ký và khóa bí mật không được để trống.");
        }
        try {
            Mac mac = Mac.getInstance(algorithm);
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                    rawSecretKey.getBytes(StandardCharsets.UTF_8),
                    algorithm
            );
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hmacBytes);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("Error computing " + algorithm + " hex signature", e);
        }
    }

    public static String hmacSha256Base64Url(String data, String rawSecretKey) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                    rawSecretKey.getBytes(StandardCharsets.UTF_8),
                    HMAC_SHA256
            );
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return base64UrlEncode(hmacBytes);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("Error computing HMAC-SHA256 signature", e);
        }
    }

    public static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8)
        );
    }

    public static boolean constantTimeEqualsIgnoreCase(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return constantTimeEquals(
                a.trim().toLowerCase(java.util.Locale.ROOT),
                b.trim().toLowerCase(java.util.Locale.ROOT)
        );
    }

    public static String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String base64UrlEncodeUtf8(String value) {
        return base64UrlEncode(value.getBytes(StandardCharsets.UTF_8));
    }

    public static byte[] base64UrlDecode(String encoded) {
        return Base64.getUrlDecoder().decode(encoded);
    }

    public static String generateSecureUrlToken(int byteLength) {
        byte[] randomBytes = new byte[byteLength];
        SECURE_RANDOM.nextBytes(randomBytes);
        return base64UrlEncode(randomBytes);
    }
}

