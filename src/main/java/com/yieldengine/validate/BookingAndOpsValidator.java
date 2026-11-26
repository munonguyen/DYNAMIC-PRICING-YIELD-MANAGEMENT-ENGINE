package com.yieldengine.validate;

import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.entity.Conversation;
import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.Tenant;
import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ForbiddenAccessException;
import com.yieldengine.exception.IdempotencyConflictException;
import com.yieldengine.exception.TokenAlreadyConsumedException;
import com.yieldengine.repository.CheckInRepository;
import com.yieldengine.repository.ConsumedTokenRepository;
import com.yieldengine.security.SessionPrincipal;
import com.yieldengine.service.PriceLockTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Validator for Booking Hold, Idempotency, Cancellation, QR Check-in, No-Show, and Chat rules (UC-12..18).
 */
@Component
@RequiredArgsConstructor
public class BookingAndOpsValidator {

    private final ConsumedTokenRepository consumedTokenRepository;
    private final CheckInRepository checkInRepository;

    public void validateIdempotencyPayloadMatch(String storedHash, String incomingHash) {
        if (!storedHash.equals(incomingHash)) {
            throw new IdempotencyConflictException("Idempotency-Key was already used with a different request payload");
        }
    }

    public void validateTokenTargetAndReplay(PriceLockTokenService.TokenPayload payload, HoldSlotRequest request) {
        if (!payload.getGroupId().equals(request.getGroupId()) || !payload.getSlotStart().equals(request.getSlotStart())) {
            throw new IllegalArgumentException("Token target slot does not match request target");
        }
        if (consumedTokenRepository.existsById(payload.getTokenJti())) {
            throw new TokenAlreadyConsumedException("PriceLockToken has already been consumed: " + payload.getTokenJti());
        }
    }

    public void validateCancellationPermission(Reservation reservation, SessionPrincipal actor) {
        if (actor == null) {
            return;
        }
        if (actor.hasPlatformRole("ADMIN") || actor.hasTenantRole(reservation.getTenantId(), "MANAGER")) {
            return;
        }
        if (reservation.getUserId() != null && !reservation.getUserId().equals(actor.userId())) {
            throw new ForbiddenAccessException("You can only cancel your own reservation");
        }
    }

    public void validateQrIssuance(Reservation reservation, SessionPrincipal actor) {
        if (reservation.getUserId() != null
                && !reservation.getUserId().equals(actor.userId())
                && !actor.hasPlatformRole("ADMIN")) {
            throw new ForbiddenAccessException("Only the reservation owner can view its QR code");
        }
        if (!ReservationStatus.CONFIRMED.name().equals(reservation.getStatus())) {
            throw new BusinessConflictException("QR code is only issued for CONFIRMED reservations");
        }
    }

    public void validateQrScan(PriceLockTokenService.QrTokenPayload payload, SessionPrincipal scanner) {
        if (!scanner.hasTenantRole(payload.getTenantId(), "STAFF", "MANAGER")) {
            throw new ForbiddenAccessException("Scanner does not belong to the reservation's venue");
        }
        if (checkInRepository.existsByReservationId(payload.getReservationId())
                || checkInRepository.existsByQrJti(payload.getQrJti())) {
            throw new BusinessConflictException("QR code has already been scanned for check-in");
        }
    }

    public void validateManualCheckIn(Reservation reservation, SessionPrincipal actor) {
        if (!actor.hasTenantRole(reservation.getTenantId(), "MANAGER") && !actor.hasPlatformRole("ADMIN")) {
            throw new ForbiddenAccessException("Only the venue MANAGER can perform manual check-in");
        }
        if (checkInRepository.existsByReservationId(reservation.getReservationId())) {
            throw new BusinessConflictException("Reservation has already been checked in");
        }
    }

    public void validateNoShowEligibility(Reservation reservation, SessionPrincipal actor, int graceMinutes, Instant dbNow) {
        if (!actor.hasTenantRole(reservation.getTenantId(), "MANAGER", "STAFF") && !actor.hasPlatformRole("ADMIN")) {
            throw new ForbiddenAccessException("Access denied for venue: " + reservation.getTenantId());
        }
        ReservationStatus.valueOf(reservation.getStatus()).assertCanTransitionTo(ReservationStatus.NO_SHOW);

        Instant graceCutoff = reservation.getSlotStart().plus(Duration.ofMinutes(graceMinutes));
        if (dbNow.isBefore(graceCutoff)) {
            throw new BusinessConflictException("Cannot mark NO_SHOW before grace period ends at: " + graceCutoff);
        }
    }

    public String validateAndResolveChatSenderRole(SessionPrincipal actor, Conversation conv, Tenant tenant) {
        if (actor.hasTenantRole(conv.getTenantId(), "MANAGER")) {
            return "MANAGER";
        }
        if (actor.hasTenantRole(conv.getTenantId(), "STAFF")) {
            if (!Boolean.TRUE.equals(tenant.getIsStaffChatEnabled())) {
                throw new ForbiddenAccessException("Staff chat is disabled for this venue");
            }
            return "STAFF";
        }
        if (conv.getUserId().equals(actor.userId())) {
            return "USER";
        }
        throw new ForbiddenAccessException("You are not a participant of this conversation");
    }

    public void validateVenueConversationListAccess(SessionPrincipal actor, UUID venueTenantId) {
        if (!actor.hasTenantRole(venueTenantId, "MANAGER", "STAFF") && !actor.hasPlatformRole("ADMIN")) {
            throw new ForbiddenAccessException("Not authorized to view conversations for venue: " + venueTenantId);
        }
    }
}

