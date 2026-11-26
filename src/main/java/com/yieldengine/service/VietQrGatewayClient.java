package com.yieldengine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.yieldengine.config.VietQrProperties;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

@Component
public class VietQrGatewayClient {
    private final VietQrProperties properties;
    private final RestClient http;

    public VietQrGatewayClient(VietQrProperties properties) {
        this.properties = properties;
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(8));
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    public IssuedQr createDynamicQr(String order, long amount) {
        String token = token();
        JsonNode result;
        try {
            result = http.post().uri(properties.providerBase().resolve("/vqr/api/qr/generate-customer"))
                    .headers(headers -> headers.setBearerAuth(token))
                    .body(Map.of("orderId", order, "amount", amount, "content", order, "qrType", 0, "transType", "C",
                            "bankCode", properties.getBankCode(), "bankAccount", properties.getBankAccount(),
                            "userBankName", properties.getAccountName()))
                    .retrieve().body(JsonNode.class);
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 400 || ex.getStatusCode().value() == 401 || ex.getStatusCode().value() == 403) {
                throw new RequestRejected("VietQR từ chối tạo mã. Vui lòng kiểm tra cấu hình kết nối.");
            }
            throw new IllegalStateException("Chưa xác minh được việc tạo QR VietQR. Vui lòng kiểm tra lại trạng thái.");
        } catch (RestClientException ex) {
            throw new IllegalStateException("Chưa xác minh được việc tạo QR VietQR. Vui lòng kiểm tra lại trạng thái.");
        }
        String payload = field(result, "qrCode");
        String content = field(result, "content");
        String virtualAccount = field(result, "vaAccount");
        if (!order.equals(field(result, "orderId"))
                || !Long.toString(amount).equals(field(result, "amount"))
                || !properties.getBankCode().equalsIgnoreCase(field(result, "bankCode"))
                || !properties.getBankAccount().equals(field(result, "bankAccount"))
                || !payload.startsWith("000201") || payload.getBytes(StandardCharsets.UTF_8).length > 1024
                || payload.codePoints().anyMatch(Character::isISOControl)
                || content.isBlank() || content.length() > 255 || content.codePoints().anyMatch(Character::isISOControl)
                || (!virtualAccount.isEmpty() && !virtualAccount.matches("[A-Za-z0-9]{1,40}"))) {
            throw new IllegalStateException("Dữ liệu mã QR của VietQR chưa khớp đơn. Vui lòng kiểm tra lại trạng thái.");
        }
        return new IssuedQr(payload, content, field(result, "bankName"), properties.getBankAccount(), virtualAccount,
                properties.getAccountName(), properties.getBankCode());
    }

    private String token() {
        try {
            JsonNode result = http.post().uri(properties.providerBase().resolve("/vqr/api/token_generate"))
                    .headers(headers -> headers.setBasicAuth(properties.getMerchantUsername(),
                            properties.getMerchantPassword(), StandardCharsets.UTF_8))
                    .retrieve().body(JsonNode.class);
            String token = field(result, "access_token");
            if (!token.isBlank() && token.length() <= 4096 && token.codePoints().noneMatch(Character::isWhitespace)) {
                return token;
            }
        } catch (RestClientException ignored) {
            // No QR request was sent if authentication failed.
        }
        throw new RequestRejected("Chưa xác thực được kết nối merchant VietQR.");
    }

    private String field(JsonNode node, String key) {
        return node == null ? "" : node.path(key).asText("").strip();
    }

    public record IssuedQr(String payload, String content, String bankName, String bankAccount,
                           String virtualAccount, String accountName, String bankCode) {
    }

    public static class RequestRejected extends IllegalStateException {
        public RequestRejected(String message) {
            super(message);
        }
    }
}
