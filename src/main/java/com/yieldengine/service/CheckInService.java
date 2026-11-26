package com.yieldengine.service;

import com.yieldengine.dto.ops.BookingOpsDtos.CheckInResponse;
import com.yieldengine.dto.ops.BookingOpsDtos.QrCodeResponse;
import com.yieldengine.entity.*;
import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.exception.ResourceNotFoundException;
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
