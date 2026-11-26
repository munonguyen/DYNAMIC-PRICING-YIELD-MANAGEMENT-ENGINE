package com.yieldengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.MoMoGatewayProperties;
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
import java.util.Optional;
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
            String orderInfo,
            String extraDataBase64
    ) {
        validator.validateCreateRequest(reservationId, amount, properties);

        String shortRes = reservationId.toString().replace("-", "").substring(0, 8).toUpperCase();
        String orderId = properties.getPartnerCode() + "_" + shortRes + "_" + System.currentTimeMillis();
        String requestId = orderId;
        String cleanOrderInfo = hasText(orderInfo)
                ? orderInfo.trim()
                : "Thanh toan giu san ArenaPulse " + shortRes;
        String extra = extraDataBase64 != null ? extraDataBase64 : "";

        String rawSignature = buildCreateRawSignature(orderId, requestId, amount, cleanOrderInfo, extra);
        String signature = CryptoHashUtils.hmacSha256Hex(rawSignature, properties.getSecretKey());

        if (shouldCallLiveGateway()) {
            Optional<MoMoPaymentInitResult> liveResult = dispatchCreateToGateway(
                    orderId, requestId, amount, cleanOrderInfo, extra, signature, rawSignature
            );
            if (liveResult.isPresent()) {
                return liveResult.get();
            }
        }

        return buildLocalFallbackSession(orderId, requestId, amount, signature, rawSignature);
    }

    public boolean verifyIpnSignature(MoMoIpnCallbackRequest req) {
        if (req == null || !hasText(req.signature())) {
            return false;
        }
        String raw = buildIpnRawSignature(req);
        String expected = CryptoHashUtils.hmacSha256Hex(raw, properties.getSecretKey());
        return CryptoHashUtils.constantTimeEqualsIgnoreCase(expected, req.signature());
    }

    private Optional<MoMoPaymentInitResult> dispatchCreateToGateway(
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

            if (response.statusCode() >= 200 && response.statusCode() < 300 && resultCode == 0) {
                log.info("Live MoMo Sandbox created transaction orderId={} amount={}VND resultCode=0", orderId, amount);
                return Optional.of(mapper.toLiveInitResult(
                        properties, orderId, requestId, amount, apiResp, signature, rawSignature
                ));
            }

            log.warn("MoMo Sandbox rejected orderId={} httpStatus={} resultCode={} message={}",
                    orderId, response.statusCode(), resultCode, message);
            throw new IllegalStateException("MoMo Sandbox trả lỗi (" + resultCode + "): " + message);
        } catch (IOException ex) {
            log.warn("Network unreachable to MoMo Sandbox ({}), using local fallback: {}",
                    properties.getEndpoint(), ex.getMessage());
            return Optional.empty();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.warn("Interrupted calling MoMo Sandbox, using local fallback");
            return Optional.empty();
        }
    }

    private MoMoPaymentInitResult buildLocalFallbackSession(
            String orderId,
            String requestId,
            long amount,
            String signature,
            String rawSignature
    ) {
        String qrContent = "2|99|" + properties.getPartnerCode() + "|" + orderId + "|"
                + amount + "|" + signature.substring(0, 16);
        String sandboxPayUrl = properties.getRedirectUrl() + "?partnerCode=" + properties.getPartnerCode()
                + "&orderId=" + orderId + "&amount=" + amount;

        log.info("Signed local MoMo v2 payment session orderId={} amount={}VND", orderId, amount);
        return mapper.toLocalFallbackResult(
                properties, orderId, requestId, amount, sandboxPayUrl, qrContent, signature, rawSignature
        );
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

    private boolean shouldCallLiveGateway() {
        return properties.isLiveHttpEnabled()
                && hasText(properties.getEndpoint())
                && properties.getEndpoint().startsWith("http");
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
