package com.yieldengine.record.ops;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;
public record CreateMoMoPaymentRequest(
        @NotNull UUID reservationId,
        @NotNull @Min(1) Long amount,
        String customerName,
        String customerPhone,
        @Email String customerEmail,
        Boolean needVatInvoice,
        String vatCompanyName,
        String vatTaxCode,
        String bookingNote
) {
}
