package com.yieldengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.PricingProperties;
import com.yieldengine.enums.TokenPurpose;
import com.yieldengine.exception.InvalidTokenSignatureException;
import com.yieldengine.utils.CryptoHashUtils;
import com.yieldengine.validate.TokenFormatValidator;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PriceLockTokenService {

    private final PricingProperties pricingProperties;
    private final ObjectMapper objectMapper;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenPayload {
        private String kid;
        private UUID tokenJti;
        private UUID tenantId;
        private String userId;
        private UUID groupId;
        private Instant slotStart;
        private Long lockedPrice;
        private Instant expiresAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QrTokenPayload {
        private String purpose;
        private String kid;
        private UUID qrJti;
        private UUID tenantId;
        private UUID reservationId;
        private Instant slotStart;
        private Instant expiresAt;
    }

    public String generateToken(
            String kid,
            UUID tokenJti,
            UUID tenantId,
            String userId,
            UUID groupId,
            Instant slotStart,
            Long lockedPrice,
            Instant expiresAt
    ) {
        TokenPayload payload = TokenPayload.builder()
                .kid(kid)
                .tokenJti(tokenJti)
                .tenantId(tenantId)
                .userId(userId)
                .groupId(groupId)
                .slotStart(slotStart)
                .lockedPrice(lockedPrice)
                .expiresAt(expiresAt)
                .build();
        return serializeAndSign(payload, TokenPurpose.PRICE_LOCK);
    }

    public TokenPayload verifyAndExtract(String token) {
        String encodedPayload = TokenFormatValidator.validateEnvelopeAndSignature(
                token, resolveSecret(TokenPurpose.PRICE_LOCK), TokenPurpose.PRICE_LOCK
        );
        TokenPayload payload = deserializePayload(encodedPayload, TokenPayload.class);
        TokenFormatValidator.validateNotExpired(payload.getExpiresAt(), "PriceLockToken");
        return payload;
    }

    public String generateQrToken(
            String kid,
            UUID qrJti,
            UUID tenantId,
            UUID reservationId,
            Instant slotStart,
            Instant expiresAt
    ) {
        QrTokenPayload payload = QrTokenPayload.builder()
                .purpose(TokenPurpose.QR_CHECKIN.name())
                .kid(kid)
                .qrJti(qrJti)
                .tenantId(tenantId)
                .reservationId(reservationId)
                .slotStart(slotStart)
                .expiresAt(expiresAt)
                .build();
        return serializeAndSign(payload, TokenPurpose.QR_CHECKIN);
    }

    public QrTokenPayload verifyAndExtractQrToken(String qrToken) {
        String encodedPayload = TokenFormatValidator.validateEnvelopeAndSignature(
                qrToken, resolveSecret(TokenPurpose.QR_CHECKIN), TokenPurpose.QR_CHECKIN
        );
        QrTokenPayload payload = deserializePayload(encodedPayload, QrTokenPayload.class);
        TokenFormatValidator.validatePurpose(payload.getPurpose(), TokenPurpose.QR_CHECKIN);
        TokenFormatValidator.validateNotExpired(payload.getExpiresAt(), "QR check-in token");
        return payload;
    }

    /**
     * Option 2 (No-scanner PIN_COUNTER): derives a 6-digit single-use check-in PIN bound to
     * reservationId + qrJti + server QR secret so it cannot be guessed without the email ticket.
     */
    public String deriveCheckInPin(UUID reservationId, UUID qrJti) {
        if (reservationId == null || qrJti == null) {
            throw new IllegalArgumentException("reservationId and qrJti are required to derive check-in PIN");
        }
        String hmacHex = CryptoHashUtils.hmacSha256Hex(
                reservationId + ":" + qrJti + ":PIN_V1",
                resolveSecret(TokenPurpose.QR_CHECKIN)
        );
        long numeric = Long.parseUnsignedLong(hmacHex.substring(0, 12), 16) % 1_000_000L;
        return String.format("%06d", numeric);
    }

    public String hashCheckInPin(UUID reservationId, String rawPin) {
        String digits = rawPin == null ? "" : rawPin.replaceAll("\\D", "");
        return CryptoHashUtils.sha256Hex(
                reservationId + ":" + digits + ":" + resolveSecret(TokenPurpose.QR_CHECKIN)
        );
    }

    public String maskPinHint(String pin) {
        String digits = pin == null ? "" : pin.replaceAll("\\D", "");
        return digits.length() >= 2 ? "••••" + digits.substring(digits.length() - 2) : "••••••";
    }

    private String serializeAndSign(Object payload, TokenPurpose purpose) {
        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            String encodedPayload = CryptoHashUtils.base64UrlEncodeUtf8(payloadJson);
            String signature = CryptoHashUtils.hmacSha256Base64Url(encodedPayload, resolveSecret(purpose));
            return encodedPayload + "." + signature;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate signed " + purpose + " token", e);
        }
    }

    private <T> T deserializePayload(String encodedPayload, Class<T> targetType) {
        try {
            byte[] decoded = CryptoHashUtils.base64UrlDecode(encodedPayload);
            return objectMapper.readValue(decoded, targetType);
        } catch (Exception e) {
            throw new InvalidTokenSignatureException("Failed to parse signed token payload");
        }
    }

    private String resolveSecret(TokenPurpose purpose) {
        return purpose == TokenPurpose.QR_CHECKIN
                ? pricingProperties.getToken().getQrSecretKey()
                : pricingProperties.getToken().getSecretKey();
    }
}
