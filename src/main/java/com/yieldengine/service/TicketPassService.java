package com.yieldengine.service;

import com.yieldengine.record.ops.TicketPassSnapshot;
import com.yieldengine.entity.Booking;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.entity.Tenant;
import com.yieldengine.repository.BookingRepository;
import com.yieldengine.repository.PaymentRepository;
import com.yieldengine.repository.ResourceGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Centralized domain service for assembling customer pass snapshots (QR token, single-use PIN,
 * Spring Data JPA payment aggregates) and attaching security credentials cleanly across workflows.
 */
@Service
@RequiredArgsConstructor
public class TicketPassService {

    private final ResourceGroupRepository resourceGroupRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final PriceLockTokenService priceLockTokenService;
    private final PricingEngineService pricingEngineService;

    /**
     * Attaches single-use qrJti and salted SHA-256 PIN credentials when confirming a reservation.
     */
    public void attachSecurityCredentials(Reservation reservation) {
        if (reservation.getQrJti() == null) {
            reservation.setQrJti(UUID.randomUUID());
        }
        String derivedPin = priceLockTokenService.deriveCheckInPin(
                reservation.getReservationId(), reservation.getQrJti()
        );
        reservation.setCheckinPinHash(
                priceLockTokenService.hashCheckInPin(reservation.getReservationId(), derivedPin)
        );
        reservation.setCheckinPinHint(priceLockTokenService.maskPinHint(derivedPin));
    }

    @Transactional(readOnly = true)
    public TicketPassSnapshot buildPassSnapshot(Reservation reservation) {
        ResourceGroup group = resourceGroupRepository.findById(reservation.getGroupId()).orElse(null);
        Booking booking = reservation.getBookingId() != null
                ? bookingRepository.findById(reservation.getBookingId()).orElse(null)
                : null;

        Tenant tenant = group != null ? group.getTenant() : null;
        String venueName = tenant != null ? tenant.getName() : "ArenaPulse Sports Complex";
        String venueAddress = tenant != null ? tenant.getAddress() : "";
        String groupName = group != null ? group.getName() : "Cụm sân thể thao";
        String unitNumber = reservation.getUnit() != null ? reservation.getUnit().getUnitNumber() : "SAN_01";
        String effectiveMode = group != null ? group.resolveEffectiveCheckinMode() : "QR_STAFF";

        int slotMinutes = group != null && group.getSlotMinutes() != null ? group.getSlotMinutes() : 60;
        int graceMinutes = group != null && group.getNoshowGraceMinutes() != null ? group.getNoshowGraceMinutes() : 15;
        Instant slotEnd = reservation.getSlotStart().plus(Duration.ofMinutes(slotMinutes));
        Instant qrExpiresAt = slotEnd.plus(Duration.ofMinutes(graceMinutes));

        UUID qrJti = reservation.getQrJti() != null ? reservation.getQrJti() : UUID.randomUUID();
        boolean pinOnly = "PIN_COUNTER".equalsIgnoreCase(effectiveMode) || "MANUAL".equalsIgnoreCase(effectiveMode);
        String qrToken = pinOnly ? null : signQrToken(qrJti, reservation.getTenantId(),
                reservation.getReservationId(), reservation.getSlotStart(), qrExpiresAt);
        String pinCode = priceLockTokenService.deriveCheckInPin(reservation.getReservationId(), qrJti);

        long paidAmount = resolveTotalPaidAmount(reservation);
        long remainingAtVenue = Math.max(0L, reservation.getLockedPrice() - paidAmount);

        String customerName = booking != null && StringUtils.hasText(booking.getContactName())
                ? booking.getContactName().trim()
                : "Khách đã xác thực tài khoản";
        String rawPhone = booking != null && booking.getContactPhone() != null
                ? booking.getContactPhone().trim()
                : "";
        String customerEmail = booking != null ? booking.getContactEmail() : null;

        return new TicketPassSnapshot(
                reservation.getReservationId(),
                qrJti,
                qrToken,
                pinCode,
                effectiveMode,
                venueName,
                venueAddress,
                groupName,
                unitNumber,
                reservation.getSlotStart(),
                slotEnd,
                qrExpiresAt,
                reservation.getLockedPrice(),
                paidAmount,
                remainingAtVenue,
                customerName,
                maskPhone(rawPhone),
                extractPhoneLast4(rawPhone),
                customerEmail
        );
    }

    String signQrToken(UUID qrJti, UUID tenantId, UUID reservationId, Instant slotStart, Instant expiresAt) {
        return priceLockTokenService.generateQrToken(pricingEngineService.getActiveQrKeyId(),
                qrJti, tenantId, reservationId, slotStart, expiresAt);
    }

    @Transactional(readOnly = true)
    public String resolveCustomerPhoneLast4(Reservation reservation) {
        if (reservation.getBookingId() == null) {
            return "";
        }
        return bookingRepository.findById(reservation.getBookingId())
                .map(b -> extractPhoneLast4(b.getContactPhone()))
                .orElse("");
    }

    public boolean hasPaymentForPass(Reservation reservation) {
        return reservation.getDepositAmount() == 0 || resolveEscrowSettlementAmount(reservation) > 0;
    }

    public void requirePaymentForPass(Reservation reservation) {
        if (!hasPaymentForPass(reservation)) {
            throw new BusinessConflictException("Chưa có xác nhận thanh toán từ cổng cho đơn này.");
        }
    }

    @Transactional(readOnly = true)
    public long resolveTotalPaidAmount(Reservation reservation) {
        return reservation.getBookingId() == null ? 0L
                : paymentRepository.sumSuccessfulPaidByBookingId(reservation.getBookingId());
    }

    @Transactional(readOnly = true)
    public long resolveEscrowSettlementAmount(Reservation reservation) {
        return reservation.getBookingId() == null ? 0L
                : paymentRepository.sumSuccessfulEscrowByBookingId(reservation.getBookingId());
    }

    public static String extractPhoneLast4(String rawPhone) {
        if (!StringUtils.hasText(rawPhone)) {
            return "";
        }
        String digits = rawPhone.replaceAll("\\D", "");
        return digits.length() >= 4 ? digits.substring(digits.length() - 4) : digits;
    }

    public static String maskPhone(String rawPhone) {
        if (!StringUtils.hasText(rawPhone)) {
            return "Chưa cập nhật";
        }
        String clean = rawPhone.replaceAll("\\s+", "");
        if (clean.length() < 4) {
            return "•••";
        }
        return clean.substring(0, 4) + " ••• •••";
    }
}
