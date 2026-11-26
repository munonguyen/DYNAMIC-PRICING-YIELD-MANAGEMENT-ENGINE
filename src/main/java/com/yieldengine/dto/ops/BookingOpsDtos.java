package com.yieldengine.dto.ops;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class BookingOpsDtos {

    private BookingOpsDtos() {
    }

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

    public record MoMoPaymentSessionResponse(
            String partnerCode,
            String orderId,
            String requestId,
            long amount,
            String payUrl,
            String qrCodeUrl,
            String deeplink,
            int resultCode,
            String message,
            boolean liveGatewayResponse,
            String signature
    ) {
    }

    public record MoMoIpnCallbackRequest(
            String partnerCode,
            @NotBlank String orderId,
            @NotBlank String requestId,
            @NotNull Long amount,
            String orderInfo,
            String orderType,
            @NotNull Long transId,
            @NotNull Integer resultCode,
            String message,
            String payType,
            @NotNull Long responseTime,
            String extraData,
            @NotBlank String signature,
            UUID reservationId
    ) {
    }

    public record ResendQrEmailRequest(
            @NotBlank @Email String recipientEmail
    ) {
    }

    public record MyTicketResponse(
            UUID reservationId,
            String venueName,
            String venueAddress,
            String groupName,
            String unitNumber,
            Instant slotStart,
            Instant slotEnd,
            String status,
            long lockedPrice,
            long depositAmount,
            long paidOnlineAmount,
            long remainingAtVenue,
            String contactEmail,
            UUID qrJti,
            String qrToken,
            Instant qrExpiresAt
    ) {
    }

    public record CancelBookingRequest(
            Instant slotStart,
            @Size(max = 100) String reason
    ) {
    }

    public record CancelBookingResponse(
            UUID reservationId,
            String status,
            long depositAmount,
            long refundAmount,
            long forfeitedAmount,
            int appliedRefundPercent,
            boolean venueInitiated,
            Instant cancelledAt
    ) {
    }

    public record QrCodeResponse(
            UUID reservationId,
            UUID qrJti,
            String qrToken,
            Instant expiresAt
    ) {
    }

    public record ScanQrRequest(
            @NotBlank String qrToken
    ) {
    }

    public record CheckInResponse(
            UUID checkInId,
            UUID reservationId,
            UUID tenantId,
            String method,
            String reservationStatus,
            Instant scannedAt
    ) {
    }

    public record OpenConversationRequest(
            @NotNull UUID tenantId,
            UUID bookingId
    ) {
    }

    public record SendMessageRequest(
            @NotBlank @Size(min = 1, max = 4000) String body
    ) {
    }
}

