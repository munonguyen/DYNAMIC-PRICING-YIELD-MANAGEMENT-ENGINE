package com.yieldengine.validate;

import com.yieldengine.record.vnpay.CreateVnPayPaymentRequest;
import com.yieldengine.record.vnpay.VnPayRefundRequest;
import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.VnPayTransaction;
import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.enums.VnPayTransactionStatus;
import com.yieldengine.exception.BusinessConflictException;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Domain validator for VNPAY checkout initiation and refund constraints.
 */
@Component
public class VnPayPaymentValidator {

    private static final long MIN_VNPAY_AMOUNT_VND = 1_000L;
    private static final long MAX_VNPAY_AMOUNT_VND = 1_000_000_000L;
    private static final Set<String> ALLOWED_LOCALES = Set.of("vn", "en");

    public long validateAndResolveAmount(CreateVnPayPaymentRequest request, Reservation reservation) {
        ReservationStatus currentStatus = ReservationStatus.valueOf(reservation.getStatus());
        if (currentStatus != ReservationStatus.HELD && currentStatus != ReservationStatus.EXPIRED) {
            throw new BusinessConflictException(
                    "Chỉ có thể tạo thanh toán VNPAY cho đơn ở trạng thái HELD/EXPIRED (hiện tại: " + currentStatus + ")."
            );
        }

        long expectedDeposit = reservation.getDepositAmount() != null ? reservation.getDepositAmount() : 0L;
        long expectedFull = reservation.getLockedPrice() != null ? reservation.getLockedPrice() : 0L;
        long requestedAmount = request.amount() != null
                ? request.amount()
                : (expectedDeposit > 0 ? expectedDeposit : expectedFull);

        if (requestedAmount < MIN_VNPAY_AMOUNT_VND || requestedAmount > MAX_VNPAY_AMOUNT_VND) {
            throw new IllegalArgumentException(
                    "Số tiền thanh toán VNPAY phải từ 1.000₫ đến 1.000.000.000₫."
            );
        }

        boolean matchesDeposit = expectedDeposit > 0 && requestedAmount == expectedDeposit;
        boolean matchesFull = expectedFull > 0 && requestedAmount == expectedFull;
        if (!matchesDeposit && !matchesFull) {
            throw new IllegalArgumentException(
                    "Số tiền VNPAY (" + requestedAmount + "₫) phải khớp tiền cọc ("
                            + expectedDeposit + "₫) hoặc tổng giá đơn (" + expectedFull + "₫)."
            );
        }

        if (request.locale() != null && !request.locale().isBlank() && !ALLOWED_LOCALES.contains(request.locale())) {
            throw new IllegalArgumentException("Ngôn ngữ VNPAY không hợp lệ: " + request.locale());
        }
        return requestedAmount;
    }

    public void validateRefundRequest(VnPayRefundRequest request, VnPayTransaction transaction) {
        if (transaction.getStatus() != VnPayTransactionStatus.SUCCESS) {
            throw new BusinessConflictException(
                    "Chỉ được hoàn tiền giao dịch VNPAY đã thành công (trạng thái hiện tại: " + transaction.getStatus() + ")."
            );
        }
        if (request.amountVnd() > transaction.getAmountVnd()) {
            throw new IllegalArgumentException(
                    "Số tiền hoàn (" + request.amountVnd() + "₫) vượt quá số tiền gốc (" + transaction.getAmountVnd() + "₫)."
            );
        }
        if ("02".equals(request.transactionType()) && !request.amountVnd().equals(transaction.getAmountVnd())) {
            throw new IllegalArgumentException(
                    "Hoàn tiền toàn phần (02) bắt buộc bằng đúng số tiền gốc (" + transaction.getAmountVnd() + "₫)."
            );
        }
    }
}

