package com.yieldengine.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.dto.SlotOccupancyChangedEvent;
import com.yieldengine.record.ops.CancelBookingResponse;
import com.yieldengine.record.ops.PaymentWebhookRequest;
import com.yieldengine.record.ops.CreateQrPaymentRequest;
import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.dto.response.HoldSlotResponse;
import com.yieldengine.entity.*;
import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.enums.VnPayTransactionStatus;
import com.yieldengine.exception.ForbiddenAccessException;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.exception.SlotUnavailableException;
import com.yieldengine.mapper.BookingMapper;
import com.yieldengine.repository.*;
import com.yieldengine.security.AuthContext;
import com.yieldengine.record.security.SessionPrincipal;
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
import java.util.List;
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
    private final VnPayTransactionRepository vnPayTransactionRepository;
    private final ConsumedTokenRepository consumedTokenRepository;
    private final IdempotencyKeyRepository idempotencyKeyRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final PriceLockTokenService priceLockTokenService;
    private final TicketPassService ticketPassService;
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

    @Transactional
    public HoldSlotResponse holdSlot(HoldSlotRequest request) {
        return holdSlot(request, request.getIdempotencyKey());
    }

    @Transactional
    public Reservation prepareGatewayPayment(UUID reservationId, UUID userId) {
        Reservation reservation = lockReservation(reservationId);
        requireOwner(reservation, userId);
        Instant now = DbClockUtils.now(jdbcTemplate);
        if (!ReservationStatus.HELD.name().equals(reservation.getStatus())
                || reservation.getHoldExpiresAt() == null || !reservation.getHoldExpiresAt().isAfter(now)
                || !reservation.getSlotStart().isAfter(now)) {
            throw new BusinessConflictException("Chỉ khởi tạo thanh toán cho lượt giữ sân còn hiệu lực.");
        }
        if (vnPayTransactionRepository.existsByReservationIdAndStatus(reservationId, VnPayTransactionStatus.PENDING)
                || paymentRepository.existsByBookingIdAndProviderInAndStatus(
                        reservation.getBookingId(), List.of("MOMO_WALLET", "VIETQR_NAPAS"), "PENDING")) {
            throw new BusinessConflictException("Đơn đang có giao dịch chờ xử lý. Vui lòng kiểm tra giao dịch đã tạo.");
        }
        return reservation;
    }

    @Transactional
    public void beginQrPayment(CreateQrPaymentRequest request, UUID userId, String provider, String orderId) {
        Reservation reservation = prepareGatewayPayment(request.reservationId(), userId);
        validateGatewayAmount(reservation, request.amount());
        updateBookingContactDetails(request.reservationId(), request.customerName(), request.customerPhone(),
                request.customerEmail(), request.needVatInvoice(), request.vatCompanyName(), request.vatTaxCode(),
                request.bookingNote());
        Booking booking = bookingRepository.findById(reservation.getBookingId()).orElseThrow();
        paymentRepository.save(Payment.builder().tenant(booking.getTenant()).booking(booking)
                .provider(provider).providerRef(orderId).amount(request.amount()).currency(booking.getCurrency())
                .paymentType(resolvePaymentTypeForAmount(reservation, request.amount())).status("PENDING").build());
    }

    @Transactional
    public void savePaymentQr(UUID reservationId, String provider, String orderId, String qrPayload,
                              boolean sandbox, Map<String, Object> metadata) {
        Reservation reservation = lockReservation(reservationId);
        paymentRepository.findByProviderAndProviderRef(provider, orderId)
                .filter(payment -> reservation.getBookingId().equals(payment.getBooking().getId()))
                .filter(payment -> "PENDING".equals(payment.getStatus()))
                .ifPresent(payment -> {
                    payment.setCheckoutQrPayload(qrPayload);
                    payment.setCheckoutQrSandbox(sandbox);
                    payment.setRawPayload(metadata);
                });
    }

    @Transactional
    public void markQrCreateRejected(UUID reservationId, String provider, String orderId) {
        Reservation reservation = lockReservation(reservationId);
        paymentRepository.findByProviderAndProviderRef(provider, orderId)
                .filter(payment -> reservation.getBookingId().equals(payment.getBooking().getId()))
                .filter(payment -> "PENDING".equals(payment.getStatus()))
                .ifPresent(payment -> payment.setStatus("FAILED"));
    }

    @Transactional
    public Reservation processPaymentWebhook(PaymentWebhookRequest webhook) {
        if (!List.of("VNPAY_ESCROW", "MOMO_WALLET", "VIETQR_NAPAS").contains(webhook.provider())) {
            throw new IllegalArgumentException("Cổng thanh toán chưa được tích hợp.");
        }
        Reservation reservation = lockReservation(webhook.reservationId());
        if (webhook.slotStart() != null && !webhook.slotStart().equals(reservation.getSlotStart())) {
            throw new IllegalArgumentException("Khung giờ giao dịch không khớp đơn đặt.");
        }
        var existing = paymentRepository.findByProviderAndProviderRef(webhook.provider(), webhook.providerRef());
        if (!"VNPAY_ESCROW".equals(webhook.provider()) && existing.isEmpty()) {
            throw new BusinessConflictException("Không tìm thấy phiên thanh toán của đơn.");
        }
        if (existing.isPresent()) {
            Payment payment = existing.get();
            if (reservation.getBookingId() == null || !reservation.getBookingId().equals(payment.getBooking().getId())
                    || !java.util.Objects.equals(payment.getAmount(), webhook.amount())) {
                throw new BusinessConflictException("Giao dịch không khớp đơn đặt hoặc số tiền đã đăng ký.");
            }
            if (!"PENDING".equals(payment.getStatus())) {
                return reservation;
            }
        }

        ResourceGroup group = resourceGroupRepository.findById(reservation.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found"));
        Booking booking = ensureBookingLinked(reservation, group);
        Instant now = DbClockUtils.now(jdbcTemplate);
        validateGatewayAmount(reservation, webhook.amount());
        String paymentType = resolvePaymentTypeForAmount(reservation, webhook.amount());
        Payment payment = existing.orElseGet(() -> Payment.builder().tenant(group.getTenant()).booking(booking)
                .provider(webhook.provider()).providerRef(webhook.providerRef()).amount(webhook.amount())
                .currency(booking.getCurrency()).paymentType(paymentType).build());
        payment.setGatewayVerifiedAt(now);
        payment.setCheckoutQrPayload(null);
        payment.setCheckoutQrSandbox(null);

        if (!"SUCCESS".equalsIgnoreCase(webhook.status())) {
            payment.setStatus("FAILED");
            paymentRepository.save(payment);
            return reservation;
        }

        ReservationStatus state = ReservationStatus.valueOf(reservation.getStatus());
        if (state == ReservationStatus.HELD && !reservation.getHoldExpiresAt().isAfter(now)) {
            reservation.setStatus(ReservationStatus.EXPIRED.name());
            reservationRepository.save(reservation);
            unitTimeLockRepository.findByReservationId(reservation.getReservationId())
                    .filter(lock -> "HOLD".equals(lock.getKind())).ifPresent(unitTimeLockRepository::delete);
            unitTimeLockRepository.flush();
            slotInventoryRepository.releaseHold(reservation.getGroupId(), reservation.getSlotStart());
            emitOccupancyOutboxAndEvent(reservation.getTenantId(), reservation.getGroupId(),
                    reservation.getSlotStart(), reservation.getReservationId(), now);
            state = ReservationStatus.EXPIRED;
        }

        boolean confirmed = false;
        if (state == ReservationStatus.HELD && reservation.getSlotStart().isAfter(now)) {
            confirmActiveHold(reservation, booking, now);
            confirmed = true;
        } else if (state == ReservationStatus.EXPIRED && reservation.getSlotStart().isAfter(now)) {
            var slot = timeSlotRepository.findById(new SlotId(reservation.getGroupId(), reservation.getSlotStart()));
            if (slot.isPresent() && tryRegrantExpiredHold(reservation, slot.get(), now)) {
                booking.setStatus("CONFIRMED");
                bookingRepository.save(booking);
                emitOccupancyOutboxAndEvent(reservation.getTenantId(), reservation.getGroupId(),
                        reservation.getSlotStart(), reservation.getReservationId(), now);
                confirmed = true;
            }
        }
        payment.setStatus(confirmed ? "SUCCESS" : "REVIEW_REQUIRED");
        Payment saved = paymentRepository.save(payment);
        if (confirmed) {
            financeLedgerService.recordDepositCollected(reservation, saved);
            queueQrTicketEmailIfAddressPresent(reservation, booking);
        } else {
            log.warn("Provider confirmed a payment requiring reconciliation provider={} ref={} reservation={}",
                    payment.getProvider(), payment.getProviderRef(), reservation.getReservationId());
        }
        return reservation;
    }

    private void validateGatewayAmount(Reservation reservation, Long amount) {
        if (amount == null || amount <= 0 || (!amount.equals(reservation.getDepositAmount())
                && !amount.equals(reservation.getLockedPrice()))) {
            throw new IllegalArgumentException("Số tiền thanh toán phải khớp tiền cọc hoặc tổng giá đơn.");
        }
    }

    private Reservation lockReservation(UUID reservationId) {
        return reservationRepository.lockByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt sân."));
    }

    static void requireOwner(Reservation reservation, UUID userId) {
        if (!userId.equals(reservation.getUserId())) {
            throw new ForbiddenAccessException("Chỉ người đặt sân được truy cập thanh toán của đơn.");
        }
    }

    @Transactional
    public CancelBookingResponse cancelReservationWithPolicy(UUID reservationId, Instant slotStartHint, String reason) {
        Reservation reservation = lockReservation(reservationId);
        if (slotStartHint != null && !slotStartHint.equals(reservation.getSlotStart())) {
            throw new IllegalArgumentException("Khung giờ không khớp đơn đặt.");
        }
        ReservationStatus currentStatus = ReservationStatus.valueOf(reservation.getStatus());
        SessionPrincipal actor = AuthContext.current().orElse(null);
        bookingValidator.validateCancellationPermission(reservation, actor);

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

    void settleNoShowBalance(Reservation reservation, ResourceGroup group, long collectedEscrow) {
        long refundableBalance = Math.max(0, collectedEscrow - reservation.getForfeitedAmount());
        reservation.setRefundAmount(refundableBalance);
        Payment refund = createRefundPaymentIfApplicable(reservation, group, refundableBalance);
        financeLedgerService.recordCancellationSettlement(reservation, refund,
                group.getSportType() != null ? group.getSportType().getId() : null, collectedEscrow);
    }

    private Payment createRefundPaymentIfApplicable(Reservation reservation, ResourceGroup group, long refundAmount) {
        if (refundAmount <= 0 || reservation.getBookingId() == null) {
            return null;
        }
        Booking booking = bookingRepository.findById(reservation.getBookingId()).orElse(null);
        if (booking == null) {
            return null;
        }
        Optional<Payment> originalPayment = paymentRepository
                .findFirstByBookingIdAndGatewayVerifiedAtIsNotNullAndPaymentTypeNotAndStatusOrderByGatewayVerifiedAtDesc(
                        booking.getId(), "REFUND", "SUCCESS");
        return paymentRepository.save(Payment.builder()
                .tenant(group.getTenant())
                .booking(booking)
                .provider("PLATFORM_REFUND")
                .providerRef("REFUND_" + reservation.getReservationId())
                .paymentType("REFUND")
                .relatedPaymentId(originalPayment.map(Payment::getId).orElse(null))
                .amount(refundAmount)
                .currency(group.getCurrency())
                .status("PENDING")
                .build());
    }

    private void confirmActiveHold(Reservation reservation, Booking booking, Instant now) {
        ReservationStatus.valueOf(reservation.getStatus()).assertCanTransitionTo(ReservationStatus.CONFIRMED);
        reservation.setStatus(ReservationStatus.CONFIRMED.name());
        reservation.setConfirmedAt(now);
        reservation.setHoldExpiresAt(null);
        ticketPassService.attachSecurityCredentials(reservation);
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
        UUID unitId = reservation.getUnit().getId();
        unitTimeLockRepository.deleteExpiredHoldLocksForUnit(unitId);
        String period = TimeAndRangeUtils.toHalfOpenTstzRange(reservation.getSlotStart(), slot.getSlotEnd());
        UUID lockId = UUID.randomUUID();
        if (unitTimeLockRepository.insertBookingIfAvailable(lockId, reservation.getTenantId(), unitId,
                reservation.getSlotStart(), period, reservation.getReservationId()) == 0) {
            return false;
        }
        if (slotInventoryRepository.incrementConfirmedCountIfAvailable(reservation.getGroupId(), reservation.getSlotStart()) == 0) {
            unitTimeLockRepository.deleteById(lockId);
            return false;
        }
        reservation.setStatus(ReservationStatus.CONFIRMED.name());
        reservation.setConfirmedAt(now);
        reservation.setHoldExpiresAt(null);
        ticketPassService.attachSecurityCredentials(reservation);
        reservationRepository.save(reservation);
        return true;
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
        return ticketPassService.resolveEscrowSettlementAmount(reservation);
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
