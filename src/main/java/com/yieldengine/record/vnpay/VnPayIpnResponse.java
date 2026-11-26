package com.yieldengine.record.vnpay;

import com.fasterxml.jackson.annotation.JsonProperty;
/**
 * Strict JSON structure mandated by VNPAY Server-to-Server IPN acknowledgment protocol.
 */
public record VnPayIpnResponse(
        @JsonProperty("RspCode") String rspCode,
        @JsonProperty("Message") String message
) {
}
