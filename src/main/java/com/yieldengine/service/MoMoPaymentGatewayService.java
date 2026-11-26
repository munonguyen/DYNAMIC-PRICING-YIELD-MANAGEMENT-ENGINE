package com.yieldengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.MoMoGatewayProperties;
import com.yieldengine.exception.MoMoSessionRejectedException;
import com.yieldengine.record.momo.MoMoGatewayApiResponse;
import com.yieldengine.record.momo.MoMoGatewayCreatePayload;
import com.yieldengine.record.momo.MoMoPaymentInitResult;
import com.yieldengine.record.ops.MoMoIpnCallbackRequest;
import com.yieldengine.mapper.MoMoGatewayMapper;
import com.yieldengine.utils.CryptoHashUtils;
import com.yieldengine.validate.MoMoPaymentValidator;
import lombok.extern.slf4j.Slf4j;
import org.mapstruct.factory.Mappers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Objects;
import java.util.UUID;

/**
 * Orchestrates MoMo PayGate v2 payment session creation and HMAC-SHA256 IPN verification
 * using externalized properties, domain validator, MapStruct mapper, and shared crypto utils.
 */
@Slf4j
@Service
public class MoMoPaymentGatewayService {

    private final MoMoGatewayProperties properties;
    private final MoMoPaymentValidator validator;
    private final MoMoGatewayMapper mapper;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Autowired
    public MoMoPaymentGatewayService(
            MoMoGatewayProperties properties,
            MoMoPaymentValidator validator,
            MoMoGatewayMapper mapper,
            ObjectMapper objectMapper
    ) {
        this(
                properties,
                validator,
                mapper,
                objectMapper,
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
        );
    }

    MoMoPaymentGatewayService(
            MoMoGatewayProperties properties,
            MoMoPaymentValidator validator,
            MoMoGatewayMapper mapper,
            ObjectMapper objectMapper,
            HttpClient httpClient
    ) {
        this.properties = properties;
        this.validator = validator != null ? validator : new MoMoPaymentValidator();
        this.mapper = mapper != null ? mapper : Mappers.getMapper(MoMoGatewayMapper.class);
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.httpClient = httpClient;
    }

    public MoMoPaymentInitResult createPaymentSession(
            UUID reservationId,
            long amount,
            String orderId,
            String orderInfo,
            String extraDataBase64
    ) {
        validateInitiation(reservationId, amount);

        String shortRes = reservationId.toString().replace("-", "").substring(0, 8).toUpperCase();
        String requestId = orderId;
        String cleanOrderInfo = hasText(orderInfo)
                ? orderInfo.trim()
                : "Thanh toan giu san ArenaPulse " + shortRes;
        String extra = extraDataBase64 != null ? extraDataBase64 : "";

        String rawSignature = buildCreateRawSignature(orderId, requestId, amount, cleanOrderInfo, extra);
        String signature = CryptoHashUtils.hmacSha256Hex(rawSignature, properties.getSecretKey());

        return dispatchCreateToGateway(orderId, requestId, amount, cleanOrderInfo, extra, signature, rawSignature);
    }

    public boolean verifyIpnSignature(MoMoIpnCallbackRequest req) {
        if (req == null || !hasValidMerchantCredentials() || !hasText(req.signature())
                || !Objects.equals(properties.getPartnerCode(), req.partnerCode())) {
            return false;
        }
        String raw = buildIpnRawSignature(req);
        String expected = CryptoHashUtils.hmacSha256Hex(raw, properties.getSecretKey());
        return CryptoHashUtils.constantTimeEqualsIgnoreCase(expected, req.signature());
    }

    private MoMoPaymentInitResult dispatchCreateToGateway(
            String orderId,
            String requestId,
            long amount,
            String orderInfo,
            String extraData,
            String signature,
            String rawSignature
    ) {
        MoMoGatewayCreatePayload payload = mapper.toGatewayCreatePayload(
                properties, orderId, requestId, amount, orderInfo, extraData, signature
        );
        try {
            String json = objectMapper.writeValueAsString(payload);
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(properties.getEndpoint()))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );
            MoMoGatewayApiResponse apiResp = objectMapper.readValue(response.body(), MoMoGatewayApiResponse.class);
            int resultCode = apiResp.resultCode() != null ? apiResp.resultCode() : -1;
            String message = hasText(apiResp.message()) ? apiResp.message() : "Không rõ phản hồi từ MoMo Sandbox";

            if (response.statusCode() >= 200 && response.statusCode() < 300 && resultCode == 0
                    && Objects.equals(apiResp.orderId(), orderId) && Objects.equals(apiResp.requestId(), requestId)
                    && Objects.equals(apiResp.partnerCode(), properties.getPartnerCode()) && Objects.equals(apiResp.amount(), amount)) {
                String qrPayload = apiResp.qrCodeUrl();
                if (!hasText(qrPayload) || qrPayload.getBytes(StandardCharsets.UTF_8).length > 1024
                        || qrPayload.codePoints().anyMatch(Character::isISOControl)) {
                    throw new IllegalStateException("MoMo chưa cấp mã QR cho giao dịch. Vui lòng kiểm tra cấu hình QR của merchant.");
                }
                log.info("MoMo created QR for orderId={} amount={}VND", orderId, amount);
                return mapper.toLiveInitResult(properties, orderId, requestId, amount, apiResp, signature, rawSignature);
            }

            log.warn("MoMo Sandbox rejected orderId={} httpStatus={} resultCode={} message={}",
                    orderId, response.statusCode(), resultCode, message);
            if (resultCode > 0 && response.statusCode() < 500) {
                throw new MoMoSessionRejectedException();
            }
            throw new IllegalStateException("Chưa xác nhận được việc khởi tạo phiên MoMo.");
        } catch (IOException ex) {
            throw new IllegalStateException("Chưa kết nối được với MoMo. Hệ thống sẽ kiểm tra trạng thái giao dịch.", ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Chưa nhận được phản hồi từ MoMo.", ex);
        }
    }

    private String buildCreateRawSignature(
            String orderId,
            String requestId,
            long amount,
            String orderInfo,
            String extraData
    ) {
        return "accessKey=" + properties.getAccessKey()
                + "&amount=" + amount
                + "&extraData=" + extraData
                + "&ipnUrl=" + properties.getIpnUrl()
                + "&orderId=" + orderId
                + "&orderInfo=" + orderInfo
                + "&partnerCode=" + properties.getPartnerCode()
                + "&redirectUrl=" + properties.getRedirectUrl()
                + "&requestId=" + requestId
                + "&requestType=" + properties.getRequestType();
    }

    private String buildIpnRawSignature(MoMoIpnCallbackRequest req) {
        String pCode = hasText(req.partnerCode()) ? req.partnerCode() : properties.getPartnerCode();
        String orderInfo = req.orderInfo() != null ? req.orderInfo() : "";
        String orderType = req.orderType() != null ? req.orderType() : "momo_wallet";
        String message = req.message() != null ? req.message() : "Successful.";
        String payType = req.payType() != null ? req.payType() : "qr";
        String extra = req.extraData() != null ? req.extraData() : "";

        return "accessKey=" + properties.getAccessKey()
                + "&amount=" + req.amount()
                + "&extraData=" + extra
                + "&message=" + message
                + "&orderId=" + req.orderId()
                + "&orderInfo=" + orderInfo
                + "&orderType=" + orderType
                + "&partnerCode=" + pCode
                + "&payType=" + payType
                + "&requestId=" + req.requestId()
                + "&responseTime=" + req.responseTime()
                + "&resultCode=" + req.resultCode()
                + "&transId=" + req.transId();
    }

    public void validateInitiation(UUID reservationId, long amount) {
        if (!isConfigured()) {
            throw new IllegalStateException("Cổng MoMo chưa được cấu hình.");
        }
        validator.validateCreateRequest(reservationId, amount, properties);
    }

    public boolean isConfigured() {
        return properties.isLiveHttpEnabled() && hasText(properties.getEndpoint())
                && hasValidMerchantCredentials() && hasHttpsIpnUrl();
    }

    public boolean isSandbox() {
        return "test-payment.momo.vn".equalsIgnoreCase(URI.create(properties.getEndpoint()).getHost());
    }

    private boolean hasValidMerchantCredentials() {
        return hasText(properties.getPartnerCode()) && !"MOMOBKUN20180529".equals(properties.getPartnerCode())
                && hasText(properties.getAccessKey()) && hasText(properties.getSecretKey());
    }

    private boolean hasHttpsIpnUrl() {
        if (!hasText(properties.getIpnUrl())) return false;
        try {
            URI ipn = URI.create(properties.getIpnUrl());
            String host = ipn.getHost();
            return "https".equalsIgnoreCase(ipn.getScheme()) && host != null
                    && !"localhost".equalsIgnoreCase(host) && !host.startsWith("127.");
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
