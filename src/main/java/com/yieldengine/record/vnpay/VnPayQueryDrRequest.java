package com.yieldengine.record.vnpay;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record VnPayQueryDrRequest(
        @NotBlank @Size(max = 100) String txnRef,
        @Size(max = 255) String orderInfo
) {
}
