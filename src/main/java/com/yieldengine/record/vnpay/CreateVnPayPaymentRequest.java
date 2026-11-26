package com.yieldengine.record.vnpay;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;
public record CreateVnPayPaymentRequest(
        @NotNull UUID reservationId,
        @Min(1000) Long amount,
        @Size(max = 30) String bankCode,
        @Pattern(regexp = "^(vn|en)$", message = "Ngôn ngữ VNPAY chỉ hỗ trợ 'vn' hoặc 'en'.") String locale,
        @Size(max = 50) String orderType,
        @Size(max = 255) String orderInfo,
        @Size(max = 150) String customerName,
        @Size(max = 25) String customerPhone,
        @Email String customerEmail,
        Boolean needVatInvoice,
        @Size(max = 200) String vatCompanyName,
        @Size(max = 20) String vatTaxCode,
        @Size(max = 500) String bookingNote
) {
}
