package com.yieldengine.service;

import com.yieldengine.dto.ops.BookingOpsDtos.CheckInResponse;
import com.yieldengine.dto.ops.BookingOpsDtos.QrCodeResponse;
import com.yieldengine.dto.ops.BookingOpsDtos.QrInspectResponse;
import com.yieldengine.entity.CheckIn;
import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ForbiddenAccessException;
import com.yieldengine.exception.InvalidTokenSignatureException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.exception.TokenExpiredException;
import com.yieldengine.repository.CheckInRepository;
import com.yieldengine.repository.ReservationRepository;
import com.yieldengine.repository.ResourceGroupRepository;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.security.SessionPrincipal;
import com.yieldengine.utils.CryptoHashUtils;
import com.yieldengine.utils.DbClockUtils;
import com.yieldengine.validate.BookingAndOpsValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Handles venue check-in verification: 4-layer QR inspection & scanning (Option 1),
 * single-use 6-digit email PIN verification with brute-force lockout (Option 2),
 * manual manager override, and grace-period No-Show settlement.
 */
@Service
@RequiredArgsConstructor
public class CheckInService {

    private static final int MAX_PIN_ATTEMPTS = 5;
    private static final Duration PIN_LOCK_DURATION = Duration.ofMinutes(5);

    private final ReservationRepository reservationRepository;
    private final ResourceGroupRepository resourceGroupRepository;
    private final CheckInRepository checkInRepository;
    private final PriceLockTokenService priceLockTokenService;
    private final TicketPassService ticketPassService;
    private final FinanceLedgerService financeLedgerService;
    private final AuditLogService auditLogService;
    private final RbacGuard rbacGuard;
    private final BookingAndOpsValidator bookingValidator;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public QrCodeResponse issueOrGetQrCode(UUID reservationId) {
        SessionPrincipal actor = rbacGuard.requireAuthenticated();
        Reservation reservation = reservationRepository.findByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));

        bookingValidator.validateQrIssuance(reservation, actor);
        ticketPassService.attachSecurityCredentials(reservation);
        reservationRepository.save(reservation);

        TicketPassService.TicketPassSnapshot pass = ticketPassService.buildPassSnapshot(reservation);
        return new QrCodeResponse(reservationId, pass.qrJti(), pass.qrToken(), pass.qrExpiresAt());
    }

    @Transactional(readOnly = true)
    public QrInspectResponse inspectQrTicket(String qrToken) {
        SessionPrincipal scanner = rbacGuard.requireAuthenticated();

        PriceLockTokenService.QrTokenPayload payload;
        try {
            payload = priceLockTokenService.verifyAndExtractQrToken(qrToken);
        } catch (TokenExpiredException ex) {
            return rejectedInspect("EXPIRED", "Vé QR đã quá hạn sử dụng (hết giờ chơi + ân hạn 15 phút).",
                    true, false, false, false, "EXPIRED");
        } catch (InvalidTokenSignatureException | IllegalArgumentException ex) {
            return rejectedInspect("INVALID_SIGNATURE",
                    "Cảnh báo: Mã vé không hợp lệ hoặc đã bị chỉnh sửa.",
                    false, false, false, false, "TAMPERED");
        }

        boolean venueMatched = scanner.hasTenantRole(payload.getTenantId(), "STAFF", "MANAGER")
                || scanner.hasPlatformRole("ADMIN");
        Reservation reservation = reservationRepository
                .findByIdAndSlotStart(payload.getReservationId(), payload.getSlotStart())
                .orElse(null);

        if (reservation == null) {
            return rejectedInspect("NOT_FOUND", "Không tìm thấy đơn đặt sân khớp với mã QR trên hệ thống.",
                    true, true, venueMatched, false, "NOT_FOUND");
        }

        return evaluateReservationInspect(reservation, payload.getQrJti(), venueMatched);
    }

    @Transactional
    public CheckInResponse scanQrCheckIn(String qrToken) {
        return scanQrCheckIn(qrToken, null);
    }

    @Transactional
    public CheckInResponse scanQrCheckIn(String qrToken, String phoneLast4) {
        PriceLockTokenService.QrTokenPayload payload = priceLockTokenService.verifyAndExtractQrToken(qrToken);
        SessionPrincipal scanner = rbacGuard.requireAuthenticated();

        bookingValidator.validateQrScan(payload, scanner);
        Reservation reservation = reservationRepository.findByIdAndSlotStart(payload.getReservationId(), payload.getSlotStart())
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found"));

        if (phoneLast4 != null && !phoneLast4.isBlank()) {
            String expectedLast4 = ticketPassService.resolveCustomerPhoneLast4(reservation);
            if (!expectedLast4.isBlank() && !expectedLast4.equals(phoneLast4.trim())) {
                throw new BusinessConflictException("4 số cuối SĐT khách đọc không khớp với thông tin đặt sân.");
            }
        }

        return completeCheckInInternal(reservation, scanner, "QR_SCAN", payload.getQrJti());
    }

    @Transactional(noRollbackFor = {BusinessConflictException.class})
    public CheckInResponse verifyPinCheckIn(UUID reservationId, String rawPin, String phoneLast4) {
        SessionPrincipal staff = rbacGuard.requireAuthenticated();
        Reservation reservation = reservationRepository.findByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));

        validatePinCheckInEligibility(reservation, staff);

        Instant dbNow = DbClockUtils.now(jdbcTemplate);
        if (reservation.getPinLockedUntil() != null && dbNow.isBefore(reservation.getPinLockedUntil())) {
            throw new BusinessConflictException("Đã nhập sai mã PIN quá 5 lần — quầy tạm khóa 5 phút để chống đoán mã.");
        }

        ticketPassService.attachSecurityCredentials(reservation);
        String candidateHash = priceLockTokenService.hashCheckInPin(reservationId, rawPin);
        if (!CryptoHashUtils.constantTimeEquals(reservation.getCheckinPinHash(), candidateHash)) {
            recordFailedPinAttempt(reservation, dbNow);
        }

        if (phoneLast4 != null && !phoneLast4.isBlank()) {
            String expectedLast4 = ticketPassService.resolveCustomerPhoneLast4(reservation);
            if (!expectedLast4.isBlank() && !expectedLast4.equals(phoneLast4.trim())) {
                throw new BusinessConflictException("4 số cuối SĐT khách đọc không khớp với chủ vé đã đặt sân.");
            }
        }

        reservation.setPinFailedAttempts(0);
        reservation.setPinLockedUntil(null);
        reservation.setPinConsumedAt(dbNow);
        return completeCheckInInternal(reservation, staff, "PIN_COUNTER", null);
    }

    @Transactional
    public CheckInResponse manualCheckIn(UUID reservationId) {
        Reservation reservation = reservationRepository.findByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));

        SessionPrincipal manager = rbacGuard.requireAuthenticated();
        bookingValidator.validateManualCheckIn(reservation, manager);

        return completeCheckInInternal(reservation, manager, "MANUAL", null);
    }

    @Transactional
    public Reservation markNoShow(UUID reservationId) {
        Reservation reservation = reservationRepository.findByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));

        SessionPrincipal actor = rbacGuard.requireAuthenticated();
        ResourceGroup group = resourceGroupRepository.findById(reservation.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found"));

        Instant dbNow = DbClockUtils.now(jdbcTemplate);
        int graceMinutes = group.getNoshowGraceMinutes() != null ? group.getNoshowGraceMinutes() : 15;
        bookingValidator.validateNoShowEligibility(reservation, actor, graceMinutes, dbNow);

        reservation.setStatus(ReservationStatus.NO_SHOW.name());
        reservation.setNoShowMarkedAt(dbNow);
        reservation.setRefundAmount(0L);
        reservation.setForfeitedAmount(reservation.getDepositAmount());
        reservation = reservationRepository.save(reservation);

        financeLedgerService.recordNoShowForfeit(
                reservation,
                group.getSportType() != null ? group.getSportType().getId() : null
        );

        auditLogService.record(
                actor.userId(),
                actor.primaryRoleCode(),
                reservation.getTenantId(),
                "RESERVATION_MARKED_NO_SHOW",
                "RESERVATION",
                reservationId.toString(),
                Map.of("forfeitedDeposit", reservation.getForfeitedAmount())
        );
        return reservation;
    }

    private void validatePinCheckInEligibility(Reservation reservation, SessionPrincipal staff) {
        if (!staff.hasTenantRole(reservation.getTenantId(), "STAFF", "MANAGER") && !staff.hasPlatformRole("ADMIN")) {
            throw new ForbiddenAccessException("Tài khoản không thuộc cơ sở của đơn đặt sân này.");
        }
        if (checkInRepository.existsByReservationId(reservation.getReservationId())
                || reservation.getPinConsumedAt() != null
                || ReservationStatus.COMPLETED.name().equals(reservation.getStatus())) {
            throw new BusinessConflictException("Mã PIN nhận sân này đã được sử dụng trước đó (Chống dùng lại 1 lần).");
        }
        if (!ReservationStatus.CONFIRMED.name().equals(reservation.getStatus())) {
            throw new BusinessConflictException("Đơn không ở trạng thái CONFIRMED để nhận sân (" + reservation.getStatus() + ").");
        }
    }

    private void recordFailedPinAttempt(Reservation reservation, Instant now) {
        int nextAttempts = (reservation.getPinFailedAttempts() != null ? reservation.getPinFailedAttempts() : 0) + 1;
        reservation.setPinFailedAttempts(nextAttempts);
        if (nextAttempts >= MAX_PIN_ATTEMPTS) {
            reservation.setPinLockedUntil(now.plus(PIN_LOCK_DURATION));
        }
        reservationRepository.save(reservation);
        int remaining = Math.max(0, MAX_PIN_ATTEMPTS - nextAttempts);
        throw new BusinessConflictException(remaining > 0
                ? "Mã PIN 6 số không đúng! Còn " + remaining + " lần thử trước khi tạm khóa 5 phút."
                : "Sai mã PIN 5 lần liên tiếp — tạm khóa xác thực đơn này trong 5 phút.");
    }

    private QrInspectResponse evaluateReservationInspect(Reservation reservation, UUID qrJti, boolean venueMatched) {
        CheckIn existingCheckIn = checkInRepository.findByReservationId(reservation.getReservationId()).orElse(null);
        boolean alreadyUsed = existingCheckIn != null || checkInRepository.existsByQrJti(qrJti);
        boolean unused = !alreadyUsed && !ReservationStatus.COMPLETED.name().equals(reservation.getStatus());

        TicketPassService.TicketPassSnapshot pass = ticketPassService.buildPassSnapshot(reservation);
        Instant previousScannedAt = existingCheckIn != null
                ? existingCheckIn.getScannedAt()
                : reservation.getCheckedInAt();

        if (!venueMatched) {
            return inspectFromSnapshot(pass, qrJti, false, "WRONG_VENUE",
                    "Vé QR hợp lệ nhưng thuộc cụm sân khác — nhân viên cơ sở này không có quyền mở sân.",
                    false, unused, reservation.getStatus(), previousScannedAt);
        }
        if (alreadyUsed || ReservationStatus.COMPLETED.name().equals(reservation.getStatus())) {
            return inspectFromSnapshot(pass, qrJti, false, "ALREADY_USED",
                    "CẢNH BÁO DÙNG LẠI VÉ: Mã QR dùng 1 lần này đã được quét check-in trước đó!",
                    true, false, reservation.getStatus(), previousScannedAt);
        }
        if (!ReservationStatus.CONFIRMED.name().equals(reservation.getStatus())) {
            return inspectFromSnapshot(pass, qrJti, false, "CANCELLED_OR_NO_SHOW",
                    "Vé không còn hiệu lực nhận sân (trạng thái: " + reservation.getStatus() + ").",
                    true, false, reservation.getStatus(), null);
        }

        return inspectFromSnapshot(pass, qrJti, true, "VALID_READY",
                "Vé hợp lệ (Đã xác thực chữ ký điện tử • Đúng cơ sở • Chưa sử dụng).",
                true, true, reservation.getStatus(), null);
    }

    private QrInspectResponse inspectFromSnapshot(
            TicketPassService.TicketPassSnapshot pass,
            UUID qrJti,
            boolean valid,
            String verdictCode,
            String verdictMessage,
            boolean venueMatched,
            boolean unused,
            String status,
            Instant previousScannedAt
    ) {
        return new QrInspectResponse(
                valid, verdictCode, verdictMessage, true, true, venueMatched, unused,
                pass.reservationId(), qrJti, pass.unitNumber(), pass.groupName(),
                pass.slotStart(), pass.slotEnd(), pass.customerName(), pass.customerPhoneMasked(),
                pass.customerEmail(), pass.lockedPrice(),
                pass.paidAmount(), pass.remainingAtVenue(), status, previousScannedAt
        );
    }

    private QrInspectResponse rejectedInspect(
            String verdictCode,
            String message,
            boolean sigValid,
            boolean notExpired,
            boolean venueMatched,
            boolean unused,
            String status
    ) {
        return new QrInspectResponse(
                false, verdictCode, message, sigValid, notExpired, venueMatched, unused,
                null, null, null, null, null, null,
                null, null, null, 0L, 0L, 0L, status, null
        );
    }

    private CheckInResponse completeCheckInInternal(
            Reservation reservation,
            SessionPrincipal actor,
            String method,
            UUID qrJti
    ) {
        ReservationStatus.valueOf(reservation.getStatus()).assertCanTransitionTo(ReservationStatus.COMPLETED);
        ResourceGroup group = resourceGroupRepository.findById(reservation.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found"));

        Instant now = DbClockUtils.now(jdbcTemplate);
        CheckIn checkIn = checkInRepository.save(CheckIn.builder()
                .tenantId(reservation.getTenantId())
                .reservationId(reservation.getReservationId())
                .slotStart(reservation.getSlotStart())
                .qrJti(qrJti)
                .scannedBy(actor.userId())
                .method(method)
                .build());

        reservation.setStatus(ReservationStatus.COMPLETED.name());
        reservation.setCheckedInAt(now);
        reservationRepository.save(reservation);

        long collectedEscrow = ticketPassService.resolveEscrowSettlementAmount(reservation);
        financeLedgerService.recordRentalCompleted(
                reservation,
                group.getSportType() != null ? group.getSportType().getId() : null,
                collectedEscrow
        );

        auditLogService.record(
                actor.userId(),
                actor.primaryRoleCode(),
                reservation.getTenantId(),
                "RESERVATION_CHECKED_IN",
                "CHECK_IN",
                checkIn.getId().toString(),
                Map.of("reservationId", reservation.getReservationId().toString(), "method", method)
        );

        return new CheckInResponse(
                checkIn.getId(),
                reservation.getReservationId(),
                reservation.getTenantId(),
                method,
                reservation.getStatus(),
                checkIn.getScannedAt() != null ? checkIn.getScannedAt() : now
        );
    }
}
