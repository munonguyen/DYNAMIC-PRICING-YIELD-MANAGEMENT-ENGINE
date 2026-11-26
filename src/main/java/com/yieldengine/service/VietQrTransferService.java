package com.yieldengine.service;

import com.yieldengine.config.VietQrProperties;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.record.ops.CreateQrPaymentRequest;
import com.yieldengine.record.ops.PaymentWebhookRequest;
import com.yieldengine.record.ops.VietQrBankNotice;
import com.yieldengine.repository.PaymentRepository;
import com.yieldengine.repository.ReservationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VietQrTransferService {
    public static final String PROVIDER = "VIETQR_NAPAS";

    private final VietQrProperties properties;
    private final VietQrGatewayClient gateway;
    private final BookingOrchestratorService bookings;
    private final ReservationRepository reservations;
    private final PaymentRepository payments;
    private final JdbcTemplate jdbc;

    public void create(CreateQrPaymentRequest request, UUID userId) {
        if (!properties.isConfigured()) {
            throw new IllegalStateException("VietQR chưa được cấu hình.");
        }
        String order = "AP" + UUID.randomUUID().toString().replace("-", "").substring(0, 11).toUpperCase(Locale.ROOT);
        bookings.beginQrPayment(request, userId, PROVIDER, order);
        try {
            var qr = gateway.createDynamicQr(order, request.amount());
            bookings.savePaymentQr(request.reservationId(), PROVIDER, order, qr.payload(), properties.isSandbox(),
                    Map.of("mode", properties.getMode().name(), "content", qr.content(), "bankCode", qr.bankCode(),
                            "bankName", qr.bankName(), "bankAccount", qr.bankAccount(),
                            "virtualAccount", qr.virtualAccount(), "accountName", qr.accountName()));
        } catch (VietQrGatewayClient.RequestRejected ex) {
            bookings.markQrCreateRejected(request.reservationId(), PROVIDER, order);
            throw ex;
        }
    }

    @Transactional
    public UUID receive(VietQrBankNotice notice) {
        String mode = properties.getMode().name();
        String account = notice.bankaccount();
        String direction = notice.transType();
        String content = notice.content().strip();
        String order = notice.orderId() == null ? "" : notice.orderId().strip();
        long amount = notice.amount().longValueExact();
        UUID eventId = UUID.randomUUID();
        var transactionTime = Timestamp.from(Instant.ofEpochMilli(notice.transactiontime()));
        int inserted = jdbc.update("""
                INSERT INTO vietqr_bank_transfers (
                    id, mode, transaction_id, reference_number, bank_account, direction,
                    amount, content, order_code, transaction_time, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED')
                ON CONFLICT DO NOTHING
                """, eventId, mode, notice.transactionid(), notice.referencenumber(), account, direction,
                amount, content, order, transactionTime);
        if (inserted == 0) {
            return findDuplicate(notice, mode, content, amount);
        }
        if ("D".equals(direction)) {
            updateOutcome(eventId, null, "IGNORED", "OUTGOING_TRANSFER");
            return eventId;
        }

        var candidates = findCandidates(mode, order, account, content);
        if (candidates.size() != 1) {
            updateOutcome(eventId, null, "REVIEW_REQUIRED", candidates.isEmpty() ? "UNMATCHED_TRANSFER" : "AMBIGUOUS_TRANSFER");
            return eventId;
        }
        var candidate = candidates.get(0);
        // All providers acquire the reservation lock before reading or changing a payment attempt.
        reservations.lockByReservationId(candidate.reservationId()).orElseThrow();
        var payment = payments.findByProviderAndProviderRef(PROVIDER, candidate.order()).orElseThrow();
        var data = payment.getRawPayload();
        String mismatch = null;
        if (!account.equals(data.get("bankAccount")) && !account.equals(data.get("virtualAccount"))) {
            mismatch = "ACCOUNT_MISMATCH";
        } else if (!content.equals(data.get("content"))) {
            mismatch = "CONTENT_MISMATCH";
        } else if (amount != payment.getAmount()) {
            mismatch = "AMOUNT_MISMATCH";
        } else if (!"PENDING".equals(payment.getStatus())) {
            mismatch = "ADDITIONAL_TRANSFER";
        }
        if (mismatch != null) {
            updateOutcome(eventId, candidate.reservationId(), "REVIEW_REQUIRED", mismatch);
            return eventId;
        }

        var result = bookings.processPaymentWebhook(new PaymentWebhookRequest(
                PROVIDER, candidate.order(), candidate.reservationId(), null, amount, "SUCCESS"));
        boolean confirmed = "CONFIRMED".equals(result.getStatus()) && "SUCCESS".equals(payment.getStatus());
        updateOutcome(eventId, candidate.reservationId(), confirmed ? "APPLIED" : "REVIEW_REQUIRED",
                confirmed ? null : "BOOKING_NOT_AVAILABLE");
        return eventId;
    }

    private UUID findDuplicate(VietQrBankNotice notice, String mode, String content, long amount) {
        var matches = jdbc.query("""
                SELECT id, transaction_id, reference_number, bank_account, direction, amount, content
                FROM vietqr_bank_transfers
                WHERE mode = ? AND (transaction_id = ? OR (bank_account = ? AND direction = ? AND reference_number = ?))
                """, (row, index) -> new ExistingTransfer(row.getObject("id", UUID.class), row.getString("reference_number"),
                        row.getString("bank_account"), row.getString("direction"), row.getLong("amount"), row.getString("content")),
                mode, notice.transactionid(), notice.bankaccount(), notice.transType(), notice.referencenumber());
        if (matches.size() == 1) {
            var match = matches.get(0);
            if (match.reference().equals(notice.referencenumber()) && match.account().equals(notice.bankaccount())
                    && match.direction().equals(notice.transType()) && match.amount() == amount && match.content().equals(content)) {
                return match.id();
            }
        }
        throw new BusinessConflictException("Mã giao dịch VietQR trùng nhưng dữ liệu không khớp.");
    }

    private List<Attempt> findCandidates(String mode, String order, String account, String content) {
        return jdbc.query("""
                SELECT r.id, p.provider_ref FROM payments p JOIN reservations r ON r.booking_id = p.booking_id
                WHERE p.provider = 'VIETQR_NAPAS' AND p.raw_payload->>'mode' = ?
                  AND ((? <> '' AND p.provider_ref = ?) OR
                       (? = '' AND (p.raw_payload->>'bankAccount' = ? OR p.raw_payload->>'virtualAccount' = ?)
                        AND p.raw_payload->>'content' = ?))
                LIMIT 2
                """, (row, index) -> new Attempt(row.getObject("id", UUID.class), row.getString("provider_ref")),
                mode, order, order, order, account, account, content);
    }

    private void updateOutcome(UUID id, UUID reservationId, String status, String reason) {
        jdbc.update("UPDATE vietqr_bank_transfers SET reservation_id = ?, status = ?, reason = ? WHERE id = ?",
                reservationId, status, reason, id);
    }

    @Transactional(readOnly = true)
    public List<ReviewItem> reviewQueue() {
        return jdbc.query("""
                SELECT id, reservation_id, reference_number, amount, content, reason, received_at
                FROM vietqr_bank_transfers WHERE mode = ? AND status = 'REVIEW_REQUIRED'
                ORDER BY received_at DESC, id LIMIT 100
                """, this::reviewItem, properties.getMode().name());
    }

    public boolean hasPendingReview(UUID reservationId, String mode) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM vietqr_bank_transfers
                    WHERE reservation_id = ? AND mode = ? AND status = 'REVIEW_REQUIRED'
                )
                """, Boolean.class, reservationId, mode));
    }

    @Transactional
    public void closeReview(UUID id, UUID userId, String note) {
        int changed = jdbc.update("""
                UPDATE vietqr_bank_transfers
                SET status = 'RESOLVED', resolved_by = ?, resolution_note = ?, resolved_at = now()
                WHERE id = ? AND mode = ? AND status = 'REVIEW_REQUIRED'
                """, userId, note.strip(), id, properties.getMode().name());
        if (changed == 0) {
            throw new ResourceNotFoundException("Không tìm thấy giao dịch VietQR đang chờ đối soát.");
        }
    }

    private ReviewItem reviewItem(ResultSet row, int index) throws SQLException {
        return new ReviewItem(row.getObject("id", UUID.class), row.getObject("reservation_id", UUID.class),
                row.getString("reference_number"), row.getLong("amount"), row.getString("content"),
                row.getString("reason"), row.getTimestamp("received_at").toInstant());
    }

    private record Attempt(UUID reservationId, String order) {}
    private record ExistingTransfer(UUID id, String reference, String account, String direction, long amount, String content) {}
    public record ReviewItem(UUID id, UUID reservationId, String reference, long amount,
                             String content, String reason, Instant receivedAt) {}
}
