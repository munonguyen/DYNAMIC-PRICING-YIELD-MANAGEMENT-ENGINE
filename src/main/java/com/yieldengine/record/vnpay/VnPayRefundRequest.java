package com.yieldengine.record.vnpay;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
public record VnPayRefundRequest(
        @NotBlank @Size(max = 100) String txnRef,
        @NotNull @Min(1000) Long amountVnd,
        @NotBlank @Pattern(regexp = "^(02|03)$", message = "vnp_TransactionType chỉ chấp nhận '02' (toàn phần) hoặc '03' (một phần).")
        String transactionType,
        @NotBlank @Size(max = 100) String createdBy,
        @Size(max = 255) String orderInfo
) {
}
