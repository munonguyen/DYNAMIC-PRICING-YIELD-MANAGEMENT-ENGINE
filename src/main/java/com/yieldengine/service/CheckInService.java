package com.yieldengine.service;

import com.yieldengine.dto.ops.BookingOpsDtos.CheckInResponse;
import com.yieldengine.dto.ops.BookingOpsDtos.QrCodeResponse;
import com.yieldengine.dto.ops.BookingOpsDtos.QrInspectResponse;
import com.yieldengine.entity.*;
import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.exception.InvalidTokenSignatureException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.exception.TokenExpiredException;
import com.yieldengine.repository.*;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.security.SessionPrincipal;
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

@Service
@RequiredArgsConstructor
public class CheckInService {

    private final ReservationRepository reservationRepository;
    private final ResourceGroupRepository resourceGroupRepository;
    private final TimeSlotRepository timeSlotRepository;
    private final CheckInRepository checkInRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final PriceLockTokenService priceLockTokenService;
    private final PricingEngineService pricingEngineService;
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

        ResourceGroup group = resourceGroupRepository.findById(reservation.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found"));
        TimeSlot slot = timeSlotRepository.findById(new SlotId(reservation.getGroupId(), reservation.getSlotStart()))
                .orElseThrow(() -> new ResourceNotFoundException("TimeSlot not found"));

        if (reservation.getQrJti() == null) {
            reservation.setQrJti(UUID.randomUUID());
            reservationRepository.save(reservation);
        }

        int graceMinutes = group.getNoshowGraceMinutes() != null ? group.getNoshowGraceMinutes() : 15;
        Instant expiresAt = slot.getSlotEnd().plus(Duration.ofMinutes(graceMinutes));
        String qrToken = priceLockTokenService.generateQrToken(
                pricingEngineService.getActiveQrKeyId(),
                reservation.getQrJti(),
                reservation.getTenantId(),
                reservationId,
                reservation.getSlotStart(),
                expiresAt
        );

        return new QrCodeResponse(reservationId, reservation.getQrJti(), qrToken, expiresAt);
    }

    @Transactional(readOnly = true)
    public QrInspectResponse inspectQrTicket(String qrToken) {
        SessionPrincipal scanner = rbacGuard.requireAuthenticated();
        PriceLockTokenService.QrTokenPayload payload;
        try {
            payload = priceLockTokenService.verifyAndExtractQrToken(qrToken);
        } catch (TokenExpiredException ex) {
            return new QrInspectResponse(
                    false, "EXPIRED", "Vé QR đã quá hạn sử dụng (hết giờ chơi + ân hạn 15 phút).",
                    true, false, false, false,
                    null, null, null, null, null, null,
                    null, null, null, null, 0L, 0L, 0L, "EXPIRED", null
            );
        } catch (InvalidTokenSignatureException | IllegalArgumentException ex) {
            return new QrInspectResponse(
                    false, "INVALID_SIGNATURE", "CẢNH BÁO VÉ GIẢ: Chữ ký HMAC-SHA256 không khớp hoặc mã QR đã bị chỉnh sửa.",
                    false, false, false, false,
                    null, null, null, null, null, null,
                    null, null, null, null, 0L, 0L, 0L, "TAMPERED", null
            );
        }

        boolean venueMatched = scanner.hasTenantRole(payload.getTenantId(), "STAFF", "MANAGER")
                || scanner.hasPlatformRole("ADMIN");
        Reservation reservation = reservationRepository
                .findByIdAndSlotStart(payload.getReservationId(), payload.getSlotStart())
                .orElse(null);

        if (reservation == null) {
            return new QrInspectResponse(
                    false, "NOT_FOUND", "Không tìm thấy đơn đặt sân khớp với mã QR trên hệ thống.",
                    true, true, venueMatched, false,
                    payload.getReservationId(), payload.getQrJti(), null, null,
                    payload.getSlotStart(), null,
                    null, null, null, null, 0L, 0L, 0L, "NOT_FOUND", null
            );
        }

        CheckIn existingCheckIn = checkInRepository.findByReservationId(reservation.getReservationId()).orElse(null);
        boolean alreadyUsed = existingCheckIn != null || checkInRepository.existsByQrJti(payload.getQrJti());
        boolean unused = !alreadyUsed && !ReservationStatus.COMPLETED.name().equals(reservation.getStatus());

        ResourceGroup group = resourceGroupRepository.findById(reservation.getGroupId()).orElse(null);
        TimeSlot slot = timeSlotRepository.findById(new SlotId(reservation.getGroupId(), reservation.getSlotStart())).orElse(null);
        Booking booking = reservation.getBookingId() != null
                ? bookingRepository.findById(reservation.getBookingId()).orElse(null)
                : null;

        long paidAmount = reservation.getBookingId() == null
                ? reservation.getDepositAmount()
                : Math.max(
                        reservation.getDepositAmount(),
                        paymentRepository.findByBookingIdOrderByCreatedAtAsc(reservation.getBookingId()).stream()
                                .filter(p -> "SUCCESS".equals(p.getStatus()))
                                .mapToLong(Payment::getAmount)
                                .sum()
                );
        long remainingAtVenue = Math.max(0L, reservation.getLockedPrice() - paidAmount);

        String rawPhone = booking != null && booking.getContactPhone() != null ? booking.getContactPhone().trim() : "";
        String last4 = rawPhone.length() >= 4 ? rawPhone.substring(rawPhone.length() - 4) : rawPhone;
        String maskedPhone = rawPhone.length() >= 7
                ? rawPhone.substring(0, 4) + " ••• " + last4
                : (rawPhone.isEmpty() ? "Chưa cập nhật" : rawPhone);

        String customerName = booking != null && booking.getContactName() != null
                ? booking.getContactName()
                : "Khách đã xác thực tài khoản";
        String customerEmail = booking != null ? booking.getContactEmail() : null;
        String unitNumber = reservation.getUnit() != null ? reservation.getUnit().getUnitNumber() : "SAN_01";
        String groupName = group != null ? group.getName() : "Cụm sân ArenaPulse";

        if (!venueMatched) {
            return new QrInspectResponse(
                    false, "WRONG_VENUE", "Vé QR hợp lệ nhưng thuộc cụm sân khác — nhân viên cơ sở này không có quyền mở sân.",
                    true, true, false, unused,
                    reservation.getReservationId(), payload.getQrJti(), unitNumber, groupName,
                    reservation.getSlotStart(), slot != null ? slot.getSlotEnd() : null,
                    customerName, maskedPhone, last4, customerEmail,
                    reservation.getLockedPrice(), paidAmount, remainingAtVenue, reservation.getStatus(),
                    existingCheckIn != null ? existingCheckIn.getScannedAt() : null
            );
        }
        if (alreadyUsed || ReservationStatus.COMPLETED.name().equals(reservation.getStatus())) {
            return new QrInspectResponse(
                    false, "ALREADY_USED", "CẢNH BÁO DÙNG LẠI VÉ: Mã QR dùng 1 lần này đã được quét check-in trước đó!",
                    true, true, true, false,
                    reservation.getReservationId(), payload.getQrJti(), unitNumber, groupName,
                    reservation.getSlotStart(), slot != null ? slot.getSlotEnd() : null,
                    customerName, maskedPhone, last4, customerEmail,
                    reservation.getLockedPrice(), paidAmount, remainingAtVenue, reservation.getStatus(),
                    existingCheckIn != null ? existingCheckIn.getScannedAt() : reservation.getCheckedInAt()
            );
        }
        if (!ReservationStatus.CONFIRMED.name().equals(reservation.getStatus())) {
            return new QrInspectResponse(
                    false, "CANCELLED_OR_NO_SHOW", "Vé không còn hiệu lực nhận sân (trạng thái: " + reservation.getStatus() + ").",
                    true, true, true, false,
                    reservation.getReservationId(), payload.getQrJti(), unitNumber, groupName,
                    reservation.getSlotStart(), slot != null ? slot.getSlotEnd() : null,
                    customerName, maskedPhone, last4, customerEmail,
                    reservation.getLockedPrice(), paidAmount, remainingAtVenue, reservation.getStatus(),
                    null
            );
        }

        return new QrInspectResponse(
                true, "VALID_READY", "Vé QR hợp lệ (Chữ ký HMAC-SHA256 khớp • Đúng cơ sở • Chưa sử dụng).",
                true, true, true, true,
                reservation.getReservationId(), payload.getQrJti(), unitNumber, groupName,
                reservation.getSlotStart(), slot != null ? slot.getSlotEnd() : null,
                customerName, maskedPhone, last4, customerEmail,
                reservation.getLockedPrice(), paidAmount, remainingAtVenue, reservation.getStatus(),
                null
        );
    }

    @Transactional
    public CheckInResponse scanQrCheckIn(String qrToken) {
        PriceLockTokenService.QrTokenPayload payload = priceLockTokenService.verifyAndExtractQrToken(qrToken);
        SessionPrincipal scanner = rbacGuard.requireAuthenticated();

        bookingValidator.validateQrScan(payload, scanner);

        Reservation reservation = reservationRepository.findByIdAndSlotStart(payload.getReservationId(), payload.getSlotStart())
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found"));

        return completeCheckInInternal(reservation, scanner, "QR_SCAN", payload.getQrJti());
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
        CheckIn checkIn = CheckIn.builder()
                .tenantId(reservation.getTenantId())
                .reservationId(reservation.getReservationId())
                .slotStart(reservation.getSlotStart())
                .qrJti(qrJti)
                .scannedBy(actor.userId())
                .method(method)
                .build();
        checkIn = checkInRepository.save(checkIn);

        reservation.setStatus(ReservationStatus.COMPLETED.name());
        reservation.setCheckedInAt(now);
        reservationRepository.save(reservation);

        long collectedEscrow = reservation.getBookingId() == null
                ? reservation.getDepositAmount()
                : Math.max(
                        reservation.getDepositAmount(),
                        paymentRepository.findByBookingIdOrderByCreatedAtAsc(reservation.getBookingId()).stream()
                                .filter(p -> "SUCCESS".equals(p.getStatus())
                                        && ("DEPOSIT".equals(p.getPaymentType())
                                        || "FULL_SETTLEMENT".equals(p.getPaymentType())))
                                .mapToLong(Payment::getAmount)
                                .sum()
                );

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
