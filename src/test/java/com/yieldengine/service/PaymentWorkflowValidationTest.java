package com.yieldengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.record.ops.CancelBookingResponse;
import com.yieldengine.record.ops.PaymentWebhookRequest;
import com.yieldengine.entity.*;
import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.mapper.BookingMapper;
import com.yieldengine.repository.*;
import com.yieldengine.service.policy.CancellationRefundPolicyEvaluator;
import com.yieldengine.validate.BookingAndOpsValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Payment Webhook Validation & Cancellation Refund Unit Tests")
class PaymentWorkflowValidationTest {

    @Mock private ResourceGroupRepository resourceGroupRepository;
    @Mock private TimeSlotRepository timeSlotRepository;
    @Mock private SlotInventoryRepository slotInventoryRepository;
    @Mock private UnitRepository unitRepository;
    @Mock private UnitTimeLockRepository unitTimeLockRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private ConsumedTokenRepository consumedTokenRepository;
    @Mock private IdempotencyKeyRepository idempotencyKeyRepository;
    @Mock private OutboxEventRepository outboxEventRepository;
    @Mock private PriceLockTokenService priceLockTokenService;
    @Mock private PricingEngineService pricingEngineService;
    @Mock private FinanceLedgerService financeLedgerService;
    @Mock private AuditLogService auditLogService;
    @Mock private BookingAndOpsValidator bookingValidator;
    @Mock private BookingMapper bookingMapper;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private JdbcTemplate jdbcTemplate;

    private BookingOrchestratorService orchestrator;
    private UUID tenantId;
    private UUID groupId;
    private UUID bookingId;
    private UUID reservationId;
    private Tenant tenant;
    private ResourceGroup group;
    private Booking booking;
    private Reservation heldReservation;

    @BeforeEach
    void setUp() {
        TicketPassService ticketPassService = new TicketPassService(
                resourceGroupRepository, bookingRepository, paymentRepository,
                priceLockTokenService, pricingEngineService
        );
        orchestrator = new BookingOrchestratorService(
                resourceGroupRepository, timeSlotRepository, slotInventoryRepository,
                unitRepository, unitTimeLockRepository, bookingRepository,
                reservationRepository, paymentRepository, consumedTokenRepository,
                idempotencyKeyRepository, outboxEventRepository, priceLockTokenService,
                ticketPassService, pricingEngineService, new CancellationRefundPolicyEvaluator(),
                financeLedgerService, auditLogService, bookingValidator,
                bookingMapper, eventPublisher, jdbcTemplate, new ObjectMapper()
        );

        tenantId = UUID.randomUUID();
        groupId = UUID.randomUUID();
        bookingId = UUID.randomUUID();
        reservationId = UUID.randomUUID();

        tenant = Tenant.builder().id(tenantId).code("T1").name("Venue").build();
        group = ResourceGroup.builder()
                .tenant(tenant)
                .sportType(SportType.builder().id((short) 1).code("PICKLEBALL").name("Pickleball").build())
                .code("PB_01").name("Court Group")
                .basePrice(200_000L).minPrice(120_000L).maxPrice(350_000L)
                .depositPercent((short) 35)
                .build();
        group.setId(groupId);

        booking = Booking.builder()
                .tenant(tenant).userId(UUID.randomUUID()).status("PENDING")
                .currency("VND").totalAmount(200_000L).depositTotal(70_000L)
                .build();
        booking.setId(bookingId);

        Instant slotStart = Instant.now().plus(Duration.ofHours(5));
        heldReservation = Reservation.builder()
                .id(new ReservationId(reservationId, slotStart))
                .tenantId(tenantId)
                .groupId(groupId)
                .bookingId(bookingId)
                .lockedPrice(200_000L)
                .depositAmount(70_000L)
                .status(ReservationStatus.HELD.name())
                .policySnapshot(Map.of(
                        "depositPercent", 35,
                        "tiers", List.of(
                                Map.of("minHoursBefore", 11, "refundPercent", 100),
                                Map.of("minHoursBefore", 4, "refundPercent", 50)
                        )
                ))
                .build();

        when(paymentRepository.findByProviderAndProviderRef(anyString(), anyString())).thenReturn(Optional.empty());
        when(reservationRepository.findByIdAndSlotStart(eq(reservationId), any())).thenReturn(Optional.of(heldReservation));
        when(resourceGroupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(jdbcTemplate.queryForObject(anyString(), eq(Instant.class))).thenReturn(Instant.now());
    }

    @Test
    @DisplayName("Rejects webhook underpayment that matches neither deposit nor full price")
    void rejectsUnderpaymentAmountMismatch() {
        PaymentWebhookRequest req = new PaymentWebhookRequest(
                "VIETQR_NAPAS", "REF_UNDERPAY", reservationId, heldReservation.getSlotStart(), 1_000L, "SUCCESS"
        );
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> orchestrator.processPaymentWebhook(req)
        );
        assertTrue(ex.getMessage().contains("không khớp"));
        verify(financeLedgerService, never()).recordDepositCollected(any(), any());
    }

    @Test
    @DisplayName("Records FAILED payment without confirming reservation when gateway status is FAILED")
    void failedWebhookDoesNotConfirmHold() {
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        PaymentWebhookRequest req = new PaymentWebhookRequest(
                "VNPAY_ESCROW", "REF_FAIL", reservationId, heldReservation.getSlotStart(), 70_000L, "FAILED"
        );
        Reservation result = orchestrator.processPaymentWebhook(req);
        assertEquals(ReservationStatus.HELD.name(), result.getStatus());

        ArgumentCaptor<Payment> payCaptor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(payCaptor.capture());
        assertEquals("FAILED", payCaptor.getValue().getStatus());
        verify(financeLedgerService, never()).recordDepositCollected(any(), any());
    }

    @Test
    @DisplayName("Full settlement collects lockedPrice and refunds pre-paid remainder plus policy refund on cancel")
    void fullSettlementAndFairCancellationRefund() {
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(unitTimeLockRepository.findByReservationId(reservationId)).thenReturn(Optional.empty());

        PaymentWebhookRequest webhook = new PaymentWebhookRequest(
                "VIETQR_NAPAS", "REF_FULL", reservationId, heldReservation.getSlotStart(), 200_000L, "SUCCESS"
        );
        Reservation confirmed = orchestrator.processPaymentWebhook(webhook);
        assertEquals(ReservationStatus.CONFIRMED.name(), confirmed.getStatus());

        ArgumentCaptor<Payment> payCaptor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(payCaptor.capture());
        assertEquals("FULL_SETTLEMENT", payCaptor.getValue().getPaymentType());

        // Now simulate cancellation 5h before play -> 50% tier applies ONLY to 70,000đ deposit (35,000đ forfeit),
        // while 130,000đ pre-paid balance is refunded 100% -> total refund = 165,000đ
        when(paymentRepository.sumSuccessfulEscrowByBookingId(bookingId)).thenReturn(200_000L);
        when(reservationRepository.findByReservationId(reservationId)).thenReturn(Optional.of(confirmed));
        when(paymentRepository.findFirstByBookingIdAndPaymentTypeAndStatusOrderByCreatedAtDesc(
                eq(bookingId), eq("DEPOSIT"), eq("SUCCESS"))).thenReturn(Optional.empty());

        CancelBookingResponse cancelRes = orchestrator.cancelReservationWithPolicy(reservationId, null, "USER_CANCELLED");
        assertEquals(165_000L, cancelRes.refundAmount());
        assertEquals(35_000L, cancelRes.forfeitedAmount());
        assertEquals(50, cancelRes.appliedRefundPercent());
    }
}
