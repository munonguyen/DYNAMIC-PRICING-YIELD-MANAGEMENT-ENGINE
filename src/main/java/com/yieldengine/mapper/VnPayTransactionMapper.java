package com.yieldengine.mapper;

import com.yieldengine.record.vnpay.VnPayReturnVerificationResponse;
import com.yieldengine.record.vnpay.VnPayTransactionSummaryDto;
import com.yieldengine.entity.VnPayTransaction;
import com.yieldengine.enums.VnPayTransactionStatus;
import org.mapstruct.Builder;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper converting VNPAY transaction entities to API response DTOs.
 */
@Mapper(componentModel = "spring", builder = @Builder(disableBuilder = true))
public interface VnPayTransactionMapper {

    @Mapping(target = "status", expression = "java(mapStatus(entity.getStatus()))")
    @Mapping(target = "secureHashValid", expression = "java(Boolean.TRUE.equals(entity.getSecureHashValid()))")
    VnPayTransactionSummaryDto toSummaryDto(VnPayTransaction entity);

    @Mapping(target = "code", source = "code")
    @Mapping(target = "message", source = "message")
    @Mapping(target = "signatureValid", source = "signatureValid")
    @Mapping(target = "paymentSucceeded", source = "paymentSucceeded")
    @Mapping(target = "txnRef", source = "entity.txnRef")
    @Mapping(target = "reservationId", source = "entity.reservationId")
    @Mapping(target = "reservationStatus", source = "reservationStatus")
    @Mapping(target = "transactionNo", source = "entity.transactionNo")
    @Mapping(target = "bankCode", source = "entity.bankCode")
    @Mapping(target = "cardType", source = "entity.cardType")
    @Mapping(target = "payDate", source = "entity.payDate")
    @Mapping(target = "responseCode", source = "entity.responseCode")
    @Mapping(target = "transactionStatus", source = "entity.transactionStatus")
    @Mapping(target = "amountVnd", expression = "java(entity != null && entity.getAmountVnd() != null ? entity.getAmountVnd() : 0L)")
    VnPayReturnVerificationResponse toReturnResponse(
            String code,
            String message,
            boolean signatureValid,
            boolean paymentSucceeded,
            VnPayTransaction entity,
            String reservationStatus
    );

    default String mapStatus(VnPayTransactionStatus status) {
        return status != null ? status.name() : null;
    }
}
