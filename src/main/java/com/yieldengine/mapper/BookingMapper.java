package com.yieldengine.mapper;

import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.dto.response.HoldSlotResponse;
import com.yieldengine.entity.ConsumedToken;
import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.ReservationId;
import com.yieldengine.entity.Unit;
import com.yieldengine.entity.UnitTimeLock;
import com.yieldengine.service.PriceLockTokenService;
import org.mapstruct.Builder;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Mapper(componentModel = "spring", builder = @Builder(disableBuilder = true))
public interface BookingMapper {

    default ReservationId toReservationId(UUID reservationId, Instant slotStart) {
        return new ReservationId(reservationId, slotStart);
    }

    default Map<String, Object> buildPricingAudit(PriceLockTokenService.TokenPayload payload, Instant now) {
        Map<String, Object> pricingAudit = new HashMap<>();
        pricingAudit.put("lockedPrice", payload.getLockedPrice());
        pricingAudit.put("tokenJti", payload.getTokenJti().toString());
        pricingAudit.put("kid", payload.getKid());
        pricingAudit.put("heldAt", now.toString());
        return pricingAudit;
    }

    @Mapping(target = "id", expression = "java(toReservationId(reservationId, request.getSlotStart()))")
    @Mapping(target = "tenantId", source = "tenantId")
    @Mapping(target = "userId", source = "resolvedUserUuid")
    @Mapping(target = "bookingId", source = "bookingId")
    @Mapping(target = "groupId", source = "request.groupId")
    @Mapping(target = "unit", source = "unit")
    @Mapping(target = "status", source = "initialStatus")
    @Mapping(target = "lockedPrice", source = "payload.lockedPrice")
    @Mapping(target = "depositAmount", source = "depositAmount")
    @Mapping(target = "refundAmount", constant = "0L")
    @Mapping(target = "forfeitedAmount", constant = "0L")
    @Mapping(target = "pricingAudit", source = "pricingAudit")
    @Mapping(target = "policySnapshot", source = "policySnapshot")
    @Mapping(target = "tokenJti", source = "payload.tokenJti")
    @Mapping(target = "qrJti", source = "qrJti")
    @Mapping(target = "holdExpiresAt", source = "holdExpiresAt")
    @Mapping(target = "confirmedAt", source = "confirmedAt")
    @Mapping(target = "checkedInAt", ignore = true)
    @Mapping(target = "noShowMarkedAt", ignore = true)
    @Mapping(target = "cancelledAt", ignore = true)
    @Mapping(target = "cancelledBy", ignore = true)
    @Mapping(target = "cancelledByRole", ignore = true)
    @Mapping(target = "cancelReason", ignore = true)
    @Mapping(target = "version", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    Reservation toReservation(
            HoldSlotRequest request,
            UUID tenantId,
            UUID resolvedUserUuid,
            UUID bookingId,
            PriceLockTokenService.TokenPayload payload,
            Unit unit,
            UUID reservationId,
            String initialStatus,
            Long depositAmount,
            Instant holdExpiresAt,
            Instant confirmedAt,
            UUID qrJti,
            Map<String, Object> pricingAudit,
            Map<String, Object> policySnapshot
    );

    @Mapping(target = "tokenJti", source = "payload.tokenJti")
    @Mapping(target = "kid", source = "payload.kid")
    @Mapping(target = "tenantId", source = "tenantId")
    @Mapping(target = "userId", source = "userId")
    @Mapping(target = "reservationId", source = "reservationId")
    @Mapping(target = "tokenExpires", source = "payload.expiresAt")
    @Mapping(target = "consumedAt", ignore = true)
    ConsumedToken toConsumedToken(PriceLockTokenService.TokenPayload payload, UUID tenantId, UUID userId, UUID reservationId);

    @Mapping(target = "tenantId", source = "tenantId")
    @Mapping(target = "unit", source = "unit")
    @Mapping(target = "slotStart", source = "slotStart")
    @Mapping(target = "period", source = "period")
    @Mapping(target = "kind", source = "kind")
    @Mapping(target = "reservationId", source = "reservationId")
    @Mapping(target = "expiresAt", source = "expiresAt")
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    UnitTimeLock toUnitTimeLock(UUID tenantId, Unit unit, Instant slotStart, String period, String kind, UUID reservationId, Instant expiresAt);

    @Mapping(target = "bookingId", source = "reservation.bookingId")
    @Mapping(target = "reservationId", source = "reservation.reservationId")
    @Mapping(target = "unitId", source = "reservation.unit.id")
    @Mapping(target = "unitNumber", source = "reservation.unit.unitNumber")
    @Mapping(target = "groupId", source = "reservation.groupId")
    @Mapping(target = "slotStart", source = "reservation.id.slotStart")
    @Mapping(target = "userId", source = "userId")
    @Mapping(target = "lockedPrice", source = "reservation.lockedPrice")
    @Mapping(target = "depositAmount", source = "reservation.depositAmount")
    @Mapping(target = "status", source = "reservation.status")
    @Mapping(target = "holdExpiresAt", source = "reservation.holdExpiresAt")
    @Mapping(target = "qrToken", source = "qrToken")
    HoldSlotResponse toHoldSlotResponse(Reservation reservation, String userId, String qrToken);
}
