package com.yieldengine.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Official VNPAY IPN acknowledgment codes returned by the merchant endpoint.
 */
@Getter
@RequiredArgsConstructor
public enum VnPayIpnAckCode {

    SUCCESS("00", "Confirm Success"),
    ORDER_NOT_FOUND("01", "Order not Found"),
    ALREADY_CONFIRMED("02", "Order already confirmed"),
    INVALID_AMOUNT("04", "Invalid Amount"),
    INVALID_CHECKSUM("97", "Invalid Checksum"),
    UNKNOWN_ERROR("99", "Unknown error");

    private final String code;
    private final String message;
}

