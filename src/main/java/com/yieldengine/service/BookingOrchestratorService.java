package com.yieldengine.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.dto.SlotOccupancyChangedEvent;
import com.yieldengine.dto.ops.BookingOpsDtos.CancelBookingResponse;
import com.yieldengine.dto.ops.BookingOpsDtos.PaymentWebhookRequest;
import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.dto.response.HoldSlotResponse;
import com.yieldengine.entity.*;
import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.exception.SlotUnavailableException;
import com.yieldengine.mapper.BookingMapper;
import com.yieldengine.repository.*;
import com.yieldengine.security.AuthContext;
import com.yieldengine.security.SessionPrincipal;
import com.yieldengine.service.policy.CancellationRefundPolicyEvaluator;
import com.yieldengine.utils.CommonTextAndPageUtils;
import com.yieldengine.utils.CryptoHashUtils;
import com.yieldengine.utils.DbClockUtils;
import com.yieldengine.utils.TimeAndRangeUtils;
import com.yieldengine.validate.BookingAndOpsValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingOrchestratorService {

    private final ResourceGroupRepository resourceGroupRepository;
    private final TimeSlotRepository timeSlotRepository;
    private final SlotInventoryRepository slotInventoryRepository;
    private final UnitRepository unitRepository;
    private final UnitTimeLockRepository unitTimeLockRepository;
    private final BookingRepository bookingRepository;
    private final ReservationRepository reservationRepository;
    private final PaymentRepository paymentRepository;
    private final ConsumedTokenRepository consumedTokenRepository;
    private final IdempotencyKeyRepository idempotencyKeyRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final PriceLockTokenService priceLockTokenService;
    private final PricingEngineService pricingEngineService;
    private final CancellationRefundPolicyEvaluator policyEvaluator;
    private final FinanceLedgerService financeLedgerService;
    private final AuditLogService auditLogService;
    private final BookingAndOpsValidator bookingValidator;
    private final BookingMapper bookingMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public HoldSlotResponse holdSlot(HoldSlotRequest request, String headerIdempotencyKey) {
        ResourceGroup group = resourceGroupRepository.findById(request.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found: " + request.getGroupId()));
        Tenant tenant = group.getTenant();
        UUID tenantId = tenant.getId();

        String idemKey = CommonTextAndPageUtils.resolveFirstNonBlank(headerIdempotencyKey, request.getIdempotencyKey());
        String requestHash = CryptoHashUtils.sha256Hex(
                group.getId() + "|" + request.getSlotStart() + "|" + request.getUserId() + "|" + request.getPriceLockToken()
        );

        if (idemKey != null) {
            Optional<IdempotencyKey> existingIdem = idempotencyKeyRepository.findById(new IdempotencyKeyId(tenantId, idemKey));
            if (existingIdem.isPresent()) {
                bookingValidator.validateIdempotencyPayloadMatch(existingIdem.get().getRequestHash(), requestHash);
                return objectMapper.convertValue(existingIdem.get().getResponseBody(), HoldSlotResponse.class);
            }
        }

        PriceLockTokenService.TokenPayload payload = priceLockTokenService.verifyAndExtract(request.getPriceLockToken());
        bookingValidator.validateTokenTargetAndReplay(payload, request);

        SlotId slotId = new SlotId(request.getGroupId(), request.getSlotStart());
        TimeSlot timeSlot = timeSlotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("TimeSlot not found for group: " + request.getGroupId()));

        Unit unit = unitRepository.findAndLockFirstAvailableUnit(request.getGroupId(), request.getSlotStart(), timeSlot.getSlotEnd())
                .orElseThrow(() -> new SlotUnavailableException("No physical court is currently available for this slot"));

        unitTimeLockRepository.deleteExpiredHoldLocksForUnit(unit.getId());

        UUID reservationId = UUID.randomUUID();
        Instant now = DbClockUtils.now(jdbcTemplate);
        int ttlSeconds = group.getHoldTtlSeconds() != null ? group.getHoldTtlSeconds() : 600;
        short depositPercent = group.getDepositPercent() != null ? group.getDepositPercent() : 0;
        long depositAmount = policyEvaluator.calculateDepositAmount(payload.getLockedPrice(), depositPercent);
        Map<String, Object> policySnapshot = policyEvaluator.createPolicySnapshot(group.getCancellationPolicy(), depositPercent);
        Map<String, Object> pricingAudit = bookingMapper.buildPricingAudit(payload, now);

        UUID resolvedUserUuid = AuthContext.current()
                .map(SessionPrincipal::userId)
                .orElseGet(() -> CommonTextAndPageUtils.parseUuidOrNull(request.getUserId()));
        boolean zeroDepositInstantConfirm = (depositAmount == 0L);

        String initialStatus = zeroDepositInstantConfirm ? ReservationStatus.CONFIRMED.name() : ReservationStatus.HELD.name();
        String lockKind = zeroDepositInstantConfirm ? "BOOKING" : "HOLD";
        Instant holdExpiresAt = zeroDepositInstantConfirm ? null : now.plusSeconds(ttlSeconds);
        Instant confirmedAt = zeroDepositInstantConfirm ? now : null;
        UUID qrJti = zeroDepositInstantConfirm ? UUID.randomUUID() : null;

        Booking booking = Booking.builder()
                .tenant(tenant)
                .userId(CommonTextAndPageUtils.uuidOrDeterministicFromText(resolvedUserUuid, request.getUserId()))
                .status(zeroDepositInstantConfirm ? "CONFIRMED" : "PENDING")
                .currency(group.getCurrency())
                .totalAmount(payload.getLockedPrice())
                .depositTotal(depositAmount)
                .idempotencyKey(idemKey)
                .expiresAt(holdExpiresAt)
                .build();
        booking = bookingRepository.save(booking);

        String periodRange = TimeAndRangeUtils.toHalfOpenTstzRange(request.getSlotStart(), timeSlot.getSlotEnd());
        UnitTimeLock lock = bookingMapper.toUnitTimeLock(
                tenantId, unit, request.getSlotStart(), periodRange, lockKind, reservationId, holdExpiresAt
        );
        unitTimeLockRepository.save(lock);

        Reservation reservation = bookingMapper.toReservation(
                request,
                tenantId,
                resolvedUserUuid,
                booking.getId(),
                payload,
                unit,
                reservationId,
                initialStatus,
                depositAmount,
                holdExpiresAt,
                confirmedAt,
                qrJti,
                pricingAudit,
                policySnapshot
        );
        reservationRepository.save(reservation);

        ConsumedToken consumedToken = bookingMapper.toConsumedToken(payload, tenantId, resolvedUserUuid, reservationId);
        consumedTokenRepository.save(consumedToken);

        int updated = zeroDepositInstantConfirm
                ? slotInventoryRepository.incrementConfirmedCountIfAvailable(request.getGroupId(), request.getSlotStart())
                : slotInventoryRepository.incrementHeldCountIfAvailable(request.getGroupId(), request.getSlotStart());
        if (updated == 0) {
            throw new SlotUnavailableException("Slot capacity reached during atomic inventory update");
        }

        emitOccupancyOutboxAndEvent(tenantId, request.getGroupId(), request.getSlotStart(), reservationId, now);

        String qrToken = null;
        if (zeroDepositInstantConfirm) {
            Instant qrExpiry = timeSlot.getSlotEnd().plus(Duration.ofMinutes(group.getNoshowGraceMinutes()));
            qrToken = priceLockTokenService.generateQrToken(
                    pricingEngineService.getActiveQrKeyId(),
                    qrJti,
                    tenantId,
                    reservationId,
                    request.getSlotStart(),
                    qrExpiry
            );
        }

        HoldSlotResponse response = bookingMapper.toHoldSlotResponse(reservation, request.getUserId(), qrToken);

        if (idemKey != null) {
            Map<String, Object> responseMap = objectMapper.convertValue(response, new TypeReference<>() {});
            idempotencyKeyRepository.save(IdempotencyKey.builder()
                    .id(new IdempotencyKeyId(tenantId, idemKey))
                    .requestHash(requestHash)
                    .responseCode((short) 201)
                    .responseBody(responseMap)
                    .build());
        }

        log.info("Reserved unit {} for user {} (status={}, lockedPrice={}, deposit={})",
                unit.getUnitNumber(), request.getUserId(), initialStatus, payload.getLockedPrice(), depositAmount);
        return response;
    }

    public HoldSlotResponse holdSlot(HoldSlotRequest request) {
        return holdSlot(request, request.getIdempotencyKey());
    }

    @Transactional
    public Reservation processPaymentWebhook(PaymentWebhookRequest webhook) {
        Optional<Payment> duplicatePayment = paymentRepository.findByProviderAndProviderRef(webhook.provider(), webhook.providerRef());
        Reservation reservation = loadReservation(webhook.reservationId(), webhook.slotStart());
        if (duplicatePayment.isPresent()) {
            log.info("Ignoring duplicate payment webhook provider={} ref={}", webhook.provider(), webhook.providerRef());
            return reservation;
        }

        ResourceGroup group = resourceGroupRepository.findById(reservation.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found"));
        Booking booking = ensureBookingLinked(reservation, group);

        Instant now = DbClockUtils.now(jdbcTemplate);
        ReservationStatus currentStatus = ReservationStatus.valueOf(reservation.getStatus());

        String normalizedWebhookStatus = webhook.status() != null
                ? webhook.status().trim().toUpperCase(java.util.Locale.ROOT)
                : "SUCCESS";
        boolean paymentSucceeded = "SUCCESS".equals(normalizedWebhookStatus)
                || "SUCCEEDED".equals(normalizedWebhookStatus);

        if (!paymentSucceeded) {
            String failedType = resolvePaymentTypeForAmount(reservation, webhook.amount());
            savePaymentRecord(group.getTenant(), booking, webhook, failedType, "FAILED");
            log.warn("Payment webhook reported status {} for reservation {}; keeping status {}",
                    normalizedWebhookStatus, reservation.getReservationId(), currentStatus);
            return reservation;
        }

        long paidAmount = webhook.amount() != null ? webhook.amount() : 0L;
        long expectedDeposit = reservation.getDepositAmount();
        long expectedFull = reservation.getLockedPrice();
        boolean matchesDeposit = expectedDeposit > 0 && paidAmount == expectedDeposit;
        boolean matchesFull = expectedFull > 0 && paidAmount == expectedFull;
        if (!matchesDeposit && !matchesFull) {
            throw new IllegalArgumentException(
                    "Số tiền thanh toán (" + paidAmount + ") không khớp tiền cọc ("
                            + expectedDeposit + ") hoặc tổng giá đơn (" + expectedFull + ")."
            );
        }
        String paymentType = resolvePaymentTypeForAmount(reservation, paidAmount);

        if (currentStatus == ReservationStatus.CONFIRMED || currentStatus == ReservationStatus.COMPLETED) {
            return reservation;
        }

        applyBookingContactFromWebhook(booking, webhook);

        if (currentStatus == ReservationStatus.HELD) {
            confirmActiveHold(reservation, booking, now);
            Payment savedPayment = savePaymentRecord(group.getTenant(), booking, webhook, paymentType, "SUCCESS");
            financeLedgerService.recordDepositCollected(reservation, savedPayment);
            queueQrTicketEmailIfAddressPresent(reservation, booking);
            return reservation;
        }

        if (currentStatus == ReservationStatus.EXPIRED) {
            TimeSlot slot = timeSlotRepository.findById(new SlotId(reservation.getGroupId(), reservation.getSlotStart()))
                    .orElseThrow(() -> new ResourceNotFoundException("TimeSlot not found"));

            if (tryRegrantExpiredHold(reservation, slot, now)) {
                booking.setStatus("CONFIRMED");
                bookingRepository.save(booking);
                Payment savedPayment = savePaymentRecord(group.getTenant(), booking, webhook, paymentType, "SUCCESS");
                financeLedgerService.recordDepositCollected(reservation, savedPayment);
                queueQrTicketEmailIfAddressPresent(reservation, booking);
                log.info("Late payment re-granted court for reservation {}", reservation.getReservationId());
            } else {
                reservation.setStatus(ReservationStatus.CANCELLED.name());
                reservation.setCancelledAt(now);
                reservation.setCancelledByRole("SYSTEM");
                reservation.setCancelReason("SOLD_OUT_ON_LATE_PAYMENT_AUTO_REFUND");
                reservationRepository.save(reservation);

                booking.setStatus("CANCELLED");
                bookingRepository.save(booking);
                savePaymentRecord(group.getTenant(), booking, webhook, paymentType, "REFUNDED");
                log.warn("Late payment arrived after court was taken; marked payment REFUNDED for reservation {}",
                        reservation.getReservationId());
            }
            return reservation;
        }

        throw new BusinessConflictException("Cannot process payment for reservation in status: " + currentStatus);
    }

    @Transactional
    public void confirmReservation(UUID reservationId) {
        Reservation reservation = loadReservation(reservationId, null);
        long amount = reservation.getDepositAmount() > 0 ? reservation.getDepositAmount() : reservation.getLockedPrice();
        processPaymentWebhook(new PaymentWebhookRequest(
                "INTERNAL_DIRECT",
                "DIRECT_CONFIRM_" + reservationId,
                reservationId,
                reservation.getSlotStart(),
                amount,
                "SUCCESS"
        ));
    }

    @Transactional
    public CancelBookingResponse cancelReservationWithPolicy(UUID reservationId, Instant slotStartHint, String reason) {
        Reservation reservation = loadReservation(reservationId, slotStartHint);
        ReservationStatus currentStatus = ReservationStatus.valueOf(reservation.getStatus());

        if (currentStatus == ReservationStatus.CANCELLED) {
            return new CancelBookingResponse(
                    reservationId,
                    reservation.getStatus(),
                    reservation.getDepositAmount(),
                    reservation.getRefundAmount(),
                    reservation.getForfeitedAmount(),
                    0,
                    false,
                    reservation.getCancelledAt()
            );
        }

        currentStatus.assertCanTransitionTo(ReservationStatus.CANCELLED);

        SessionPrincipal actor = AuthContext.current().orElse(null);
        bookingValidator.validateCancellationPermission(reservation, actor);

        boolean venueInitiated = actor != null
                && (actor.hasPlatformRole("ADMIN") || actor.hasTenantRole(reservation.getTenantId(), "MANAGER"));
        String actorRole = actor == null ? "USER" : (actor.hasPlatformRole("ADMIN") ? "ADMIN"
                : (actor.hasTenantRole(reservation.getTenantId(), "MANAGER") ? "MANAGER" : "USER"));
        UUID actorId = actor != null ? actor.userId() : null;

        ResourceGroup group = resourceGroupRepository.findById(reservation.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found"));

        Instant dbNow = DbClockUtils.now(jdbcTemplate);
        long refundAmount = 0L;
        long forfeitedAmount = 0L;
        int appliedPercent = 0;

        long collectedOnlineAmount = resolveCollectedOnlineAmount(reservation);
        if (currentStatus == ReservationStatus.CONFIRMED && collectedOnlineAmount > 0) {
            long prePaidBalance = Math.max(0L, collectedOnlineAmount - reservation.getDepositAmount());
            if (reservation.getDepositAmount() > 0) {
                var eval = policyEvaluator.evaluate(
                        reservation.getDepositAmount(),
                        reservation.getPolicySnapshot(),
                        reservation.getSlotStart(),
                        dbNow,
                        venueInitiated
                );
                refundAmount = eval.refundAmount() + prePaidBalance;
                forfeitedAmount = eval.forfeitedAmount();
                appliedPercent = eval.appliedRefundPercent();
            } else {
                refundAmount = prePaidBalance;
                forfeitedAmount = 0L;
                appliedPercent = 100;
            }
        }

        reservation.setStatus(ReservationStatus.CANCELLED.name());
        reservation.setRefundAmount(refundAmount);
        reservation.setForfeitedAmount(forfeitedAmount);
        reservation.setCancelledAt(dbNow);
        reservation.setCancelledBy(actorId);
        reservation.setCancelledByRole(actorRole);
        reservation.setCancelReason(reason != null ? reason : (venueInitiated ? "VENUE_CANCELLED" : "USER_CANCELLED"));
        reservationRepository.save(reservation);

        if (reservation.getBookingId() != null) {
            bookingRepository.findById(reservation.getBookingId()).ifPresent(b -> {
                b.setStatus("CANCELLED");
                bookingRepository.save(b);
            });
        }

        unitTimeLockRepository.findByReservationId(reservationId).ifPresent(unitTimeLockRepository::delete);

        if (currentStatus == ReservationStatus.HELD) {
            slotInventoryRepository.releaseHold(reservation.getGroupId(), reservation.getSlotStart());
        } else if (currentStatus == ReservationStatus.CONFIRMED) {
            slotInventoryRepository.releaseConfirmed(reservation.getGroupId(), reservation.getSlotStart());
        }

        if (currentStatus == ReservationStatus.CONFIRMED && collectedOnlineAmount > 0) {
            Payment refundPayment = createRefundPaymentIfApplicable(reservation, group, refundAmount);
            financeLedgerService.recordCancellationSettlement(
                    reservation,
                    refundPayment,
                    group.getSportType() != null ? group.getSportType().getId() : null,
                    collectedOnlineAmount
            );
        }

        emitOccupancyOutboxAndEvent(
                reservation.getTenantId(), reservation.getGroupId(), reservation.getSlotStart(), reservationId, dbNow
        );

        auditLogService.record(
                actorId,
                actorRole,
                reservation.getTenantId(),
                "BOOKING_CANCELLED",
                "RESERVATION",
                reservationId.toString(),
                Map.of(
                        "refundAmount", refundAmount,
                        "forfeitedAmount", forfeitedAmount,
                        "venueInitiated", venueInitiated
                )
        );

        return new CancelBookingResponse(
                reservationId,
                reservation.getStatus(),
                reservation.getDepositAmount(),
                refundAmount,
                forfeitedAmount,
                appliedPercent,
                venueInitiated,
                dbNow
        );
    }

    @Transactional
    public void cancelReservation(UUID reservationId) {
        cancelReservationWithPolicy(reservationId, null, "CANCELLED");
    }

    private Booking ensureBookingLinked(Reservation reservation, ResourceGroup group) {
        if (reservation.getBookingId() != null) {
            Optional<Booking> existing = bookingRepository.findById(reservation.getBookingId());
            if (existing.isPresent()) {
                return existing.get();
            }
        }
        Booking created = bookingRepository.save(Booking.builder()
                .tenant(group.getTenant())
                .userId(reservation.getUserId() != null ? reservation.getUserId() : UUID.randomUUID())
                .status("PENDING")
                .totalAmount(reservation.getLockedPrice())
                .depositTotal(reservation.getDepositAmount())
                .build());
        reservation.setBookingId(created.getId());
        return created;
    }

    private Payment createRefundPaymentIfApplicable(Reservation reservation, ResourceGroup group, long refundAmount) {
        if (refundAmount <= 0 || reservation.getBookingId() == null) {
            return null;
        }
        Booking booking = bookingRepository.findById(reservation.getBookingId()).orElse(null);
        if (booking == null) {
            return null;
        }
        Optional<Payment> originalDeposit = paymentRepository
                .findFirstByBookingIdAndPaymentTypeAndStatusOrderByCreatedAtDesc(booking.getId(), "DEPOSIT", "SUCCESS");
        return paymentRepository.save(Payment.builder()
                .tenant(group.getTenant())
                .booking(booking)
                .provider("PLATFORM_REFUND")
                .providerRef("REFUND_" + reservation.getReservationId())
                .paymentType("REFUND")
                .relatedPaymentId(originalDeposit.map(Payment::getId).orElse(null))
                .amount(refundAmount)
                .currency(group.getCurrency())
                .status("SUCCESS")
                .build());
    }

    private void confirmActiveHold(Reservation reservation, Booking booking, Instant now) {
        ReservationStatus.valueOf(reservation.getStatus()).assertCanTransitionTo(ReservationStatus.CONFIRMED);
        reservation.setStatus(ReservationStatus.CONFIRMED.name());
        reservation.setConfirmedAt(now);
        reservation.setHoldExpiresAt(null);
        if (reservation.getQrJti() == null) {
            reservation.setQrJti(UUID.randomUUID());
        }
        String derivedPin = priceLockTokenService.deriveCheckInPin(reservation.getReservationId(), reservation.getQrJti());
        reservation.setCheckinPinHash(priceLockTokenService.hashCheckInPin(reservation.getReservationId(), derivedPin));
        reservation.setCheckinPinHint(priceLockTokenService.maskPinHint(derivedPin));
        reservationRepository.save(reservation);

        booking.setStatus("CONFIRMED");
        bookingRepository.save(booking);

        unitTimeLockRepository.findByReservationId(reservation.getReservationId()).ifPresent(lock -> {
            lock.setKind("BOOKING");
            lock.setExpiresAt(null);
            unitTimeLockRepository.save(lock);
        });

        slotInventoryRepository.confirmHold(reservation.getGroupId(), reservation.getSlotStart());
    }

    private boolean tryRegrantExpiredHold(Reservation reservation, TimeSlot slot, Instant now) {
        unitTimeLockRepository.deleteExpiredHoldLocksForUnit(reservation.getUnit().getId());
        String periodRange = TimeAndRangeUtils.toHalfOpenTstzRange(reservation.getSlotStart(), slot.getSlotEnd());
        try {
            UnitTimeLock newLock = UnitTimeLock.builder()
                    .tenantId(reservation.getTenantId())
                    .unit(reservation.getUnit())
                    .slotStart(reservation.getSlotStart())
                    .period(periodRange)
                    .kind("BOOKING")
                    .reservationId(reservation.getReservationId())
                    .expiresAt(null)
                    .build();
            unitTimeLockRepository.saveAndFlush(newLock);

            int updated = slotInventoryRepository.incrementConfirmedCountIfAvailable(
                    reservation.getGroupId(), reservation.getSlotStart()
            );
            if (updated == 0) {
                unitTimeLockRepository.delete(newLock);
                return false;
            }

            reservation.setStatus(ReservationStatus.CONFIRMED.name());
            reservation.setConfirmedAt(now);
            reservation.setHoldExpiresAt(null);
            if (reservation.getQrJti() == null) {
                reservation.setQrJti(UUID.randomUUID());
            }
            reservationRepository.save(reservation);
            return true;
        } catch (DataIntegrityViolationException ex) {
            return false;
        }
    }

    private void applyBookingContactFromWebhook(Booking booking, PaymentWebhookRequest webhook) {
        boolean changed = false;
        if (webhook.customerName() != null && !webhook.customerName().isBlank()) {
            booking.setContactName(webhook.customerName().trim());
            changed = true;
        }
        if (webhook.customerPhone() != null && !webhook.customerPhone().isBlank()) {
            booking.setContactPhone(webhook.customerPhone().trim());
            changed = true;
        }
        if (webhook.customerEmail() != null && !webhook.customerEmail().isBlank()) {
            booking.setContactEmail(webhook.customerEmail().trim());
            changed = true;
        }
        if (webhook.needVatInvoice() != null) {
            booking.setNeedVatInvoice(webhook.needVatInvoice());
            changed = true;
        }
        if (webhook.vatCompanyName() != null && !webhook.vatCompanyName().isBlank()) {
            booking.setVatCompanyName(webhook.vatCompanyName().trim());
            changed = true;
        }
        if (webhook.vatTaxCode() != null && !webhook.vatTaxCode().isBlank()) {
            booking.setVatTaxCode(webhook.vatTaxCode().trim());
            changed = true;
        }
        if (webhook.bookingNote() != null && !webhook.bookingNote().isBlank()) {
            booking.setBookingNote(webhook.bookingNote().trim());
            changed = true;
        }
        if (changed) {
            bookingRepository.save(booking);
        }
    }

    private void queueQrTicketEmailIfAddressPresent(Reservation reservation, Booking booking) {
        if (booking.getContactEmail() != null && !booking.getContactEmail().isBlank()) {
            outboxEventRepository.save(OutboxEvent.ofBookingQrEmailRequested(
                    reservation.getTenantId(),
                    reservation.getReservationId(),
                    booking.getContactEmail(),
                    booking.getContactName()
            ));
        }
    }

    @Transactional
    public void updateBookingContactDetails(
            UUID reservationId,
            String customerName,
            String customerPhone,
            String customerEmail,
            Boolean needVatInvoice,
            String vatCompanyName,
            String vatTaxCode,
            String bookingNote
    ) {
        Reservation reservation = loadReservation(reservationId, null);
        ResourceGroup group = resourceGroupRepository.findById(reservation.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found"));
        Booking booking = ensureBookingLinked(reservation, group);
        applyBookingContactFromWebhook(booking, new PaymentWebhookRequest(
                "CONTACT_UPDATE",
                "CONTACT_" + reservationId,
                reservationId,
                reservation.getSlotStart(),
                reservation.getDepositAmount() > 0 ? reservation.getDepositAmount() : 1L,
                "PENDING",
                customerName,
                customerPhone,
                customerEmail,
                needVatInvoice,
                vatCompanyName,
                vatTaxCode,
                bookingNote
        ));
    }

    @Transactional(readOnly = true)
    public java.util.List<com.yieldengine.dto.ops.BookingOpsDtos.MyTicketResponse> listMyTickets(UUID userId) {
        return reservationRepository.findByUserIdOrderBySlotStartDesc(userId).stream()
                .map(res -> {
                    ResourceGroup group = resourceGroupRepository.findById(res.getGroupId()).orElse(null);
                    Booking booking = res.getBookingId() != null
                            ? bookingRepository.findById(res.getBookingId()).orElse(null)
                            : null;
                    long paid = resolveCollectedOnlineAmount(res);
                    int grace = group != null && group.getNoshowGraceMinutes() != null ? group.getNoshowGraceMinutes() : 15;
                    int duration = group != null && group.getSlotMinutes() != null ? group.getSlotMinutes() : 60;
                    Instant slotEnd = res.getSlotStart().plus(Duration.ofMinutes(duration));
                    Instant qrExpiry = slotEnd.plus(Duration.ofMinutes(grace));
                    String qrToken = ("CONFIRMED".equals(res.getStatus()) && res.getQrJti() != null)
                            ? priceLockTokenService.generateQrToken(
                                    pricingEngineService.getActiveQrKeyId(),
                                    res.getQrJti(),
                                    res.getTenantId(),
                                    res.getReservationId(),
                                    res.getSlotStart(),
                                    qrExpiry
                            )
                            : null;
                    String effectiveCheckinMode = group != null && group.getCheckinMode() != null
                            ? group.getCheckinMode()
                            : (group != null && group.getTenant() != null ? group.getTenant().getCheckinMode() : "QR_STAFF");
                    String pinCode = ("CONFIRMED".equals(res.getStatus()) && res.getQrJti() != null && res.getPinConsumedAt() == null)
                            ? priceLockTokenService.deriveCheckInPin(res.getReservationId(), res.getQrJti())
                            : null;
                    return new com.yieldengine.dto.ops.BookingOpsDtos.MyTicketResponse(
                            res.getReservationId(),
                            group != null && group.getTenant() != null ? group.getTenant().getName() : "ArenaPulse Complex",
                            group != null && group.getTenant() != null ? group.getTenant().getAddress() : "",
                            group != null ? group.getName() : "Cụm sân",
                            res.getUnit() != null ? res.getUnit().getUnitNumber() : "SAN_01",
                            res.getSlotStart(),
                            slotEnd,
                            res.getStatus(),
                            res.getLockedPrice(),
                            res.getDepositAmount(),
                            paid,
                            Math.max(0L, res.getLockedPrice() - paid),
                            booking != null ? booking.getContactEmail() : null,
                            res.getQrJti(),
                            qrToken,
                            qrExpiry,
                            effectiveCheckinMode,
                            pinCode
                    );
                })
                .toList();
    }

    private String resolvePaymentTypeForAmount(Reservation reservation, Long amount) {
        if (amount != null
                && reservation.getLockedPrice() != null
                && amount >= reservation.getLockedPrice()
                && reservation.getLockedPrice() > reservation.getDepositAmount()) {
            return "FULL_SETTLEMENT";
        }
        return "DEPOSIT";
    }

    private long resolveCollectedOnlineAmount(Reservation reservation) {
        if (reservation.getBookingId() == null) {
            return reservation.getDepositAmount();
        }
        return paymentRepository.findByBookingIdOrderByCreatedAtAsc(reservation.getBookingId()).stream()
                .filter(p -> "SUCCESS".equals(p.getStatus())
                        && ("DEPOSIT".equals(p.getPaymentType()) || "FULL_SETTLEMENT".equals(p.getPaymentType())))
                .mapToLong(Payment::getAmount)
                .sum();
    }

    private Payment savePaymentRecord(
            Tenant tenant,
            Booking booking,
            PaymentWebhookRequest webhook,
            String paymentType,
            String status
    ) {
        return paymentRepository.save(Payment.builder()
                .tenant(tenant)
                .booking(booking)
                .provider(webhook.provider())
                .providerRef(webhook.providerRef())
                .paymentType(paymentType)
                .amount(webhook.amount())
                .currency(booking.getCurrency())
                .status(status)
                .build());
    }

    private void emitOccupancyOutboxAndEvent(
            UUID tenantId, UUID groupId, Instant slotStart, UUID reservationId, Instant now
    ) {
        outboxEventRepository.save(OutboxEvent.ofSlotOccupancyChanged(tenantId, groupId, slotStart, reservationId));
        eventPublisher.publishEvent(new SlotOccupancyChangedEvent(groupId, slotStart, now));
    }

    private Reservation loadReservation(UUID reservationId, Instant slotStartHint) {
        if (slotStartHint != null) {
            return reservationRepository.findByIdAndSlotStart(reservationId, slotStartHint)
                    .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));
        }
        return reservationRepository.findByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));
    }
}
