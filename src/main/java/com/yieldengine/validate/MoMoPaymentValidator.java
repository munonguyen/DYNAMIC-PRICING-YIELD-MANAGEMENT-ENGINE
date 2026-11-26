package com.yieldengine.validate;

import com.yieldengine.config.MoMoGatewayProperties;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

/**
 * Domain validator for MoMo PayGate v2 payment initialization and IPN resolution.
 */
@Component
public class MoMoPaymentValidator {

    private static final long MIN_MOMO_AMOUNT_VND = 1_000L;
    private static final long MAX_MOMO_SANDBOX_VND = 50_000_000L;

    public void validateCreateRequest(UUID reservationId, long amount, MoMoGatewayProperties props) {
        if (reservationId == null) {
            throw new IllegalArgumentException("Thiếu reservationId để khởi tạo giao dịch MoMo.");
        }
        if (amount < MIN_MOMO_AMOUNT_VND || amount > MAX_MOMO_SANDBOX_VND) {
            throw new IllegalArgumentException(
                    "Số tiền thanh toán MoMo hợp lệ phải từ 1.000₫ đến 50.000.000₫."
            );
        }
        if (props == null || isBlank(props.getPartnerCode()) || isBlank(props.getAccessKey()) || isBlank(props.getSecretKey())) {
            throw new IllegalStateException("Cấu hình kết nối MoMo (partnerCode/accessKey/secretKey) chưa đầy đủ.");
        }
    }

    public UUID resolveReservationIdFromIpn(UUID explicitReservationId, String extraDataBase64) {
        if (explicitReservationId != null) {
            return explicitReservationId;
        }
        if (isBlank(extraDataBase64)) {
            throw new IllegalArgumentException("Thiếu reservationId cho giao dịch MoMo IPN.");
        }
        try {
            String decoded = new String(
                    Base64.getDecoder().decode(extraDataBase64.trim()),
                    StandardCharsets.UTF_8
            ).trim();
            return UUID.fromString(decoded);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Không giải mã được reservationId từ extraData MoMo.", ex);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}

