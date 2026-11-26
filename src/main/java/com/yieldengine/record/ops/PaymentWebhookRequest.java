package com.yieldengine.record.ops;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;
public record PaymentWebhookRequest(
        @NotBlank String provider,
        @NotBlank String providerRef,
        @NotNull UUID reservationId,
        Instant slotStart,
        @NotNull @Min(1) Long amount,
        String status,
        String customerName,
        String customerPhone,
        @Email String customerEmail,
        Boolean needVatInvoice,
        String vatCompanyName,
        String vatTaxCode,
        String bookingNote
) {
    public PaymentWebhookRequest(
            String provider,
            String providerRef,
            UUID reservationId,
            Instant slotStart,
            Long amount,
            String status
    ) {
        this(provider, providerRef, reservationId, slotStart, amount, status, null, null, null, null, null, null, null);
    }
}
