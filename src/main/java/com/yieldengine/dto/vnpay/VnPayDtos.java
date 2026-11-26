package com.yieldengine.dto.vnpay;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

/**
 * Immutable request and response DTO records for VNPAY Payment Gateway v2.1.0 APIs.
 */
public final class VnPayDtos {

    private VnPayDtos() {
    }

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

    public record VnPayPaymentUrlResponse(
            String code,
            String message,
            String paymentUrl,
            String txnRef,
            UUID reservationId,
            long amountVnd,
            long vnpAmount,
            String createDate,
            String expireDate,
            String status
    ) {
    }

    public record VnPayReturnVerificationResponse(
            String code,
            String message,
            boolean signatureValid,
            boolean paymentSucceeded,
            String txnRef,
            UUID reservationId,
            String reservationStatus,
            String transactionNo,
            String bankCode,
            String cardType,
            String payDate,
            String responseCode,
            String transactionStatus,
            long amountVnd
    ) {
    }

    /**
     * Strict JSON structure mandated by VNPAY Server-to-Server IPN acknowledgment protocol.
     */
    public record VnPayIpnResponse(
            @JsonProperty("RspCode") String rspCode,
            @JsonProperty("Message") String message
    ) {
    }

    public record VnPayQueryDrRequest(
            @NotBlank @Size(max = 100) String txnRef,
            @Size(max = 255) String orderInfo
    ) {
    }

    public record VnPayQueryDrResponse(
            String txnRef,
            String responseCode,
            String message,
            String transactionNo,
            String transactionStatus,
            long amountVnd,
            String bankCode,
            String payDate,
            boolean liveGatewayResponse
    ) {
    }

    public record VnPayRefundRequest(
            @NotBlank @Size(max = 100) String txnRef,
            @NotNull @Min(1000) Long amountVnd,
            @NotBlank @Pattern(regexp = "^(02|03)$", message = "vnp_TransactionType chỉ chấp nhận '02' (toàn phần) hoặc '03' (một phần).")
            String transactionType,
            @NotBlank @Size(max = 100) String createdBy,
            @Size(max = 255) String orderInfo
    ) {
    }

    public record VnPayRefundResponse(
            String txnRef,
            String responseCode,
            String message,
            long refundAmountVnd,
            String transactionType,
            String status,
            boolean liveGatewayResponse
    ) {
    }

    public record VnPayTransactionSummaryDto(
            UUID id,
            UUID reservationId,
            UUID bookingId,
            String txnRef,
            long amountVnd,
            long vnpAmount,
            String bankCode,
            String cardType,
            String transactionNo,
            String responseCode,
            String transactionStatus,
            String payDate,
            String status,
            boolean secureHashValid,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}

