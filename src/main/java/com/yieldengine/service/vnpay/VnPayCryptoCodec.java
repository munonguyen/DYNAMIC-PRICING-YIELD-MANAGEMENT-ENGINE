package com.yieldengine.service.vnpay;

import com.yieldengine.utils.CryptoHashUtils;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;

/**
 * Encapsulates VNPAY v2.1.0 canonical parameter encoding, HMAC-SHA512 signing,
 * constant-time signature verification, and GMT+7 timestamp formatting.
 */
@Component
public class VnPayCryptoCodec {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter VNP_TIME_FMT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(VN_ZONE);
    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern DISALLOWED_ORDER_CHARS = Pattern.compile("[^a-zA-Z0-9\\s.,_-]");

    public String formatTimestamp(Instant instant) {
        return VNP_TIME_FMT.format(instant);
    }

    /**
     * VNPAY PayGate requires ASCII order info without Vietnamese accents or special symbols.
     */
    public String sanitizeOrderInfo(String rawOrderInfo, String fallback) {
        String source = (rawOrderInfo != null && !rawOrderInfo.isBlank()) ? rawOrderInfo : fallback;
        String normalized = Normalizer.normalize(source, Normalizer.Form.NFD)
                .replace('đ', 'd')
                .replace('Đ', 'D');
        String stripped = COMBINING_MARKS.matcher(normalized).replaceAll("");
        String safe = DISALLOWED_ORDER_CHARS.matcher(stripped).replaceAll(" ").trim().replaceAll("\\s+", " ");
        if (safe.isEmpty()) {
            return fallback;
        }
        return safe.length() > 255 ? safe.substring(0, 255) : safe;
    }

    /**
     * Builds canonical sorted URL query + appends HMAC-SHA512 vnp_SecureHash per VNPAY v2.1.0 spec.
     */
    public String buildSignedPaymentUrl(String basePayUrl, Map<String, String> params, String hashSecret) {
        TreeMap<String, String> sorted = filterAndSortParams(params);
        CanonicalUrlParts parts = buildCanonicalParts(sorted);
        String secureHash = hmacSha512Hex(parts.hashData(), hashSecret);
        return basePayUrl + "?" + parts.queryString() + "&vnp_SecureHash=" + secureHash;
    }

    /**
     * Verifies VNPAY Return/IPN callback parameters using constant-time HMAC-SHA512 comparison.
     */
    public boolean verifyCallbackSignature(Map<String, String> callbackParams, String hashSecret) {
        if (callbackParams == null || callbackParams.isEmpty() || hashSecret == null || hashSecret.isBlank()) {
            return false;
        }
        String receivedHash = callbackParams.get("vnp_SecureHash");
        if (receivedHash == null || receivedHash.isBlank()) {
            return false;
        }

        TreeMap<String, String> sorted = filterAndSortParams(callbackParams);
        CanonicalUrlParts parts = buildCanonicalParts(sorted);
        String expectedHash = hmacSha512Hex(parts.hashData(), hashSecret);
        return CryptoHashUtils.constantTimeEquals(
                expectedHash.toLowerCase(Locale.ROOT),
                receivedHash.trim().toLowerCase(Locale.ROOT)
        );
    }

    /**
     * Computes pipe-delimited HMAC-SHA512 signature for VNPAY Server-to-Server APIs (querydr / refund).
     */
    public String signPipeSeparated(String hashSecret, String... orderedFields) {
        String joined = String.join("|", orderedFields);
        return hmacSha512Hex(joined, hashSecret);
    }

    public String hmacSha512Hex(String data, String secretKey) {
        return CryptoHashUtils.hmacSha512Hex(data, secretKey);
    }

    private TreeMap<String, String> filterAndSortParams(Map<String, String> params) {
        TreeMap<String, String> sorted = new TreeMap<>();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if (key == null || value == null || value.isBlank()) {
                continue;
            }
            if ("vnp_SecureHash".equals(key) || "vnp_SecureHashType".equals(key)) {
                continue;
            }
            sorted.put(key, value);
        }
        return sorted;
    }

    private CanonicalUrlParts buildCanonicalParts(TreeMap<String, String> sorted) {
        StringBuilder hashData = new StringBuilder();
        StringBuilder query = new StringBuilder();
        boolean first = true;

        for (Map.Entry<String, String> entry : sorted.entrySet()) {
            String encodedKey = URLEncoder.encode(entry.getKey(), StandardCharsets.US_ASCII);
            String encodedValue = URLEncoder.encode(entry.getValue(), StandardCharsets.US_ASCII);
            if (!first) {
                hashData.append('&');
                query.append('&');
            }
            hashData.append(entry.getKey()).append('=').append(encodedValue);
            query.append(encodedKey).append('=').append(encodedValue);
            first = false;
        }
        return new CanonicalUrlParts(hashData.toString(), query.toString());
    }

    private record CanonicalUrlParts(String hashData, String queryString) {
    }
}

