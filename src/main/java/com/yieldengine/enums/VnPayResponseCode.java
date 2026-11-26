package com.yieldengine.enums;

import java.util.Map;

/**
 * Maps standard VNPAY vnp_ResponseCode values to clear domain messages.
 */
public final class VnPayResponseCode {

    public static final String CODE_SUCCESS = "00";
    public static final String CODE_USER_CANCELLED = "24";

    private static final Map<String, String> DESCRIPTIONS = Map.ofEntries(
            Map.entry("00", "Giao dịch thành công."),
            Map.entry("07", "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)."),
            Map.entry("09", "Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking tại ngân hàng."),
            Map.entry("10", "Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần."),
            Map.entry("11", "Đã hết hạn chờ thanh toán. Vui lòng thực hiện lại giao dịch."),
            Map.entry("12", "Thẻ/Tài khoản của khách hàng bị khóa."),
            Map.entry("13", "Quý khách nhập sai mật khẩu xác thực giao dịch (OTP)."),
            Map.entry("24", "Khách hàng đã hủy giao dịch thanh toán."),
            Map.entry("51", "Tài khoản không đủ số dư để thực hiện giao dịch."),
            Map.entry("65", "Tài khoản đã vượt quá hạn mức giao dịch trong ngày."),
            Map.entry("75", "Ngân hàng thanh toán đang bảo trì."),
            Map.entry("79", "Khách hàng nhập sai mật khẩu thanh toán quá số lần quy định."),
            Map.entry("97", "Chữ ký HMAC-SHA512 không hợp lệ."),
            Map.entry("99", "Lỗi không xác định từ cổng thanh toán VNPAY.")
    );

    private VnPayResponseCode() {
    }

    public static boolean isSuccess(String responseCode, String transactionStatus) {
        return CODE_SUCCESS.equals(responseCode)
                && (transactionStatus == null || transactionStatus.isBlank() || CODE_SUCCESS.equals(transactionStatus));
    }

    public static String describe(String code) {
        if (code == null || code.isBlank()) {
            return DESCRIPTIONS.get("99");
        }
        return DESCRIPTIONS.getOrDefault(code, "Giao dịch không thành công (Mã VNPAY: " + code + ").");
    }
}

