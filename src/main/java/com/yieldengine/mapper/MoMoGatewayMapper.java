package com.yieldengine.mapper;

import com.yieldengine.config.MoMoGatewayProperties;
import com.yieldengine.record.momo.MoMoGatewayApiResponse;
import com.yieldengine.record.momo.MoMoGatewayCreatePayload;
import com.yieldengine.record.momo.MoMoPaymentInitResult;
import com.yieldengine.record.ops.MoMoIpnCallbackRequest;
import com.yieldengine.record.ops.MoMoPaymentSessionResponse;
import com.yieldengine.record.ops.PaymentWebhookRequest;
import org.mapstruct.Builder;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.UUID;

@Mapper(componentModel = "spring", builder = @Builder(disableBuilder = true))
public interface MoMoGatewayMapper {

    MoMoPaymentSessionResponse toSessionResponse(MoMoPaymentInitResult init);

    @Mapping(target = "partnerCode", source = "props.partnerCode")
    @Mapping(target = "partnerName", source = "props.partnerName")
    @Mapping(target = "storeId", source = "props.storeId")
    @Mapping(target = "redirectUrl", source = "props.redirectUrl")
    @Mapping(target = "ipnUrl", source = "props.ipnUrl")
    @Mapping(target = "lang", source = "props.lang")
    @Mapping(target = "requestType", source = "props.requestType")
    @Mapping(target = "autoCapture", constant = "true")
    MoMoGatewayCreatePayload toGatewayCreatePayload(
            MoMoGatewayProperties props,
            String orderId,
            String requestId,
            long amount,
            String orderInfo,
            String extraData,
            String signature
    );

    @Mapping(target = "partnerCode", source = "props.partnerCode")
    @Mapping(target = "orderId", source = "orderId")
    @Mapping(target = "requestId", source = "requestId")
    @Mapping(target = "amount", source = "amount")
    @Mapping(target = "payUrl", expression = "java(nonNullText(apiResp.payUrl()))")
    @Mapping(target = "qrCodeUrl", expression = "java(nonNullText(apiResp.qrCodeUrl()))")
    @Mapping(target = "deeplink", expression = "java(nonNullText(apiResp.deeplink()))")
    @Mapping(target = "resultCode", constant = "0")
    @Mapping(target = "message", expression = "java(apiResp.message() != null ? apiResp.message() : \"Thành công.\")")
    @Mapping(target = "liveGatewayResponse", constant = "true")
    @Mapping(target = "signature", expression = "java(apiResp.signature() != null && !apiResp.signature().isBlank() ? apiResp.signature() : fallbackSignature)")
    @Mapping(target = "rawSignatureBase", source = "rawSignatureBase")
    MoMoPaymentInitResult toLiveInitResult(
            MoMoGatewayProperties props,
            String orderId,
            String requestId,
            long amount,
            MoMoGatewayApiResponse apiResp,
            String fallbackSignature,
            String rawSignatureBase
    );

    @Mapping(target = "partnerCode", source = "props.partnerCode")
    @Mapping(target = "deeplink", constant = "")
    @Mapping(target = "resultCode", constant = "0")
    @Mapping(target = "message", constant = "Phiên ký số MoMo cục bộ (ngoại tuyến).")
    @Mapping(target = "liveGatewayResponse", constant = "false")
    MoMoPaymentInitResult toLocalFallbackResult(
            MoMoGatewayProperties props,
            String orderId,
            String requestId,
            long amount,
            String payUrl,
            String qrCodeUrl,
            String signature,
            String rawSignatureBase
    );

    @Mapping(target = "provider", constant = "MOMO_WALLET")
    @Mapping(target = "providerRef", expression = "java(\"MOMO_\" + req.transId())")
    @Mapping(target = "reservationId", source = "resolvedReservationId")
    @Mapping(target = "slotStart", expression = "java(null)")
    @Mapping(target = "amount", source = "req.amount")
    @Mapping(target = "status", source = "status")
    @Mapping(target = "customerName", expression = "java(null)")
    @Mapping(target = "customerPhone", expression = "java(null)")
    @Mapping(target = "customerEmail", expression = "java(null)")
    @Mapping(target = "needVatInvoice", expression = "java(null)")
    @Mapping(target = "vatCompanyName", expression = "java(null)")
    @Mapping(target = "vatTaxCode", expression = "java(null)")
    @Mapping(target = "bookingNote", expression = "java(null)")
    PaymentWebhookRequest toPaymentWebhook(
            MoMoIpnCallbackRequest req,
            UUID resolvedReservationId,
            String status
    );

    default String nonNullText(String value) {
        return value != null ? value : "";
    }
}

