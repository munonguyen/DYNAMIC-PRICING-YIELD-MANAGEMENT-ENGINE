package com.yieldengine.service;

import com.yieldengine.entity.Payment;
import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.VnPayTransaction;
import com.yieldengine.enums.VnPayTransactionStatus;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.record.vnpay.VnPayRefundRequest;
import com.yieldengine.repository.PaymentRepository;
import com.yieldengine.repository.ReservationRepository;
import com.yieldengine.repository.VnPayTransactionRepository;
import com.yieldengine.validate.VnPayPaymentValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class VnPayRefundSettlement {
    private final VnPayTransactionRepository transactions;
    private final PaymentRepository payments;
    private final ReservationRepository reservations;
    private final VnPayPaymentValidator validator;
    private final FinanceLedgerService ledger;

    @Transactional
    public VnPayTransaction begin(VnPayRefundRequest request, String requestId) {
        VnPayTransaction txn = lockTransaction(request.txnRef());
        validator.validateRefundRequest(request, txn);
        Payment capture = txn.getPayment();
        if (capture == null || capture.getGatewayVerifiedAt() == null || !"SUCCESS".equals(capture.getStatus())) {
            throw new BusinessConflictException("Giao dịch gốc chưa có xác nhận thu tiền hợp lệ từ VNPay.");
        }
        Payment refund = requireRefund(txn);
        if (!"PENDING".equals(refund.getStatus()) || !refund.getAmount().equals(request.amountVnd())) {
            throw new BusinessConflictException("Yêu cầu phải khớp khoản hoàn đang chờ theo chính sách hủy sân.");
        }
        // Commit the claim before calling VNPay. A timeout cannot authorize another refund.
        refund.setRawPayload(Map.of("vnp_RequestId", requestId, "vnp_TxnRef", txn.getTxnRef()));
        txn.setStatus(VnPayTransactionStatus.REFUND_PENDING);
        return txn;
    }

    @Transactional
    public void complete(String txnRef, String refundTransactionNo, Instant verifiedAt) {
        VnPayTransaction txn = lockTransaction(txnRef);
        if (txn.getStatus() == VnPayTransactionStatus.REFUNDED) {
            return;
        }
        if (txn.getStatus() != VnPayTransactionStatus.REFUND_PENDING) {
            throw new BusinessConflictException("VNPay chưa có yêu cầu hoàn đang xử lý.");
        }
        Payment refund = requireRefund(txn);
        Reservation reservation = reservations.findByReservationId(txn.getReservationId()).orElseThrow();
        refund.setStatus("SUCCESS");
        refund.setGatewayVerifiedAt(verifiedAt);
        var metadata = new LinkedHashMap<>(refund.getRawPayload());
        metadata.put("vnp_TransactionNo", refundTransactionNo);
        refund.setRawPayload(metadata);
        txn.setStatus(VnPayTransactionStatus.REFUNDED);
        ledger.recordRefundPaid(reservation, refund);
    }

    @Transactional
    public void releaseRejected(String txnRef) {
        lockTransaction(txnRef).setStatus(VnPayTransactionStatus.SUCCESS);
    }

    private Payment requireRefund(VnPayTransaction txn) {
        return payments.findByProviderAndProviderRef("PLATFORM_REFUND", "REFUND_" + txn.getReservationId())
                .filter(refund -> Objects.equals(refund.getRelatedPaymentId(), txn.getPayment().getId()))
                .orElseThrow(() -> new BusinessConflictException("Chưa có khoản hoàn đối soát cho giao dịch VNPay này."));
    }

    private VnPayTransaction lockTransaction(String txnRef) {
        return transactions.lockByTxnRef(txnRef)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy giao dịch VNPay."));
    }
}
