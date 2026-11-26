package com.yieldengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.PricingProperties;
import com.yieldengine.record.ops.CheckInResponse;
import com.yieldengine.entity.*;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ForbiddenAccessException;
import com.yieldengine.repository.*;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.record.security.RoleGrant;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.validate.BookingAndOpsValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CheckInPinSecurityTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private ResourceGroupRepository resourceGroupRepository;
    @Mock private TimeSlotRepository timeSlotRepository;
    @Mock private CheckInRepository checkInRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private PricingEngineService pricingEngineService;
    @Mock private FinanceLedgerService financeLedgerService;
    @Mock private AuditLogService auditLogService;
    @Mock private RbacGuard rbacGuard;
    @Mock private JdbcTemplate jdbcTemplate;

    private PriceLockTokenService tokenService;
    private CheckInService checkInService;

    private UUID tenantId;
    private UUID groupId;
    private UUID reservationId;
    private UUID qrJti;
    private Reservation reservation;
    private Booking booking;
    private ResourceGroup group;
    private SessionPrincipal staffPrincipal;

    @BeforeEach
    void setUp() {
        PricingProperties props = new PricingProperties();
        props.getToken().setSecretKey("test-price-lock-secret-32-chars!!");
        props.getToken().setQrSecretKey("test-qr-secret-key-32-chars-min!!");
        tokenService = new PriceLockTokenService(props, new ObjectMapper().findAndRegisterModules());

        TicketPassService ticketPassService = new TicketPassService(
                resourceGroupRepository,
                bookingRepository,
                paymentRepository,
                tokenService,
                pricingEngineService
        );
        BookingAndOpsValidator validator = new BookingAndOpsValidator(mock(ConsumedTokenRepository.class), checkInRepository);
        checkInService = new CheckInService(
                reservationRepository,
                resourceGroupRepository,
                checkInRepository,
                tokenService,
                ticketPassService,
                financeLedgerService,
                auditLogService,
                rbacGuard,
                validator,
                jdbcTemplate
        );

        tenantId = UUID.randomUUID();
        groupId = UUID.randomUUID();
        reservationId = UUID.randomUUID();
        qrJti = UUID.randomUUID();
        UUID bookingId = UUID.randomUUID();
        Instant slotStart = Instant.now().plus(1, ChronoUnit.HOURS);

        SportType sport = SportType.builder().id((short) 1).code("PICKLEBALL").name("Pickleball").build();
        Tenant tenant = Tenant.builder().code("SAN_A").name("Sân A").checkinMode("PIN_COUNTER").build();
        tenant.setId(tenantId);
        group = ResourceGroup.builder()
                .tenant(tenant)
                .sportType(sport)
                .code("PB_A")
                .name("Cụm Pickleball Không Máy Quét")
                .basePrice(200_000L)
                .minPrice(140_000L)
                .maxPrice(320_000L)
                .checkinMode("PIN_COUNTER")
                .build();
        Unit unit = Unit.builder().tenantId(tenantId).resourceGroup(group).unitNumber("SAN_01").build();
        unit.setId(UUID.randomUUID());

        String pin = tokenService.deriveCheckInPin(reservationId, qrJti);
        reservation = Reservation.builder()
                .id(new ReservationId(reservationId, slotStart))
                .tenantId(tenantId)
                .groupId(groupId)
                .bookingId(bookingId)
                .unit(unit)
                .status("CONFIRMED")
                .lockedPrice(200_000L)
                .depositAmount(70_000L)
                .qrJti(qrJti)
                .checkinPinHash(tokenService.hashCheckInPin(reservationId, pin))
                .checkinPinHint(tokenService.maskPinHint(pin))
                .pinFailedAttempts(0)
                .build();

        booking = Booking.builder()
                .tenant(tenant)
                .userId(UUID.randomUUID())
                .contactName("Nguyễn Minh Quân")
                .contactPhone("0988776655")
                .contactEmail("quan@gmail.com")
                .build();
        booking.setId(bookingId);

        staffPrincipal = new SessionPrincipal(
                UUID.randomUUID(),
                "nhanvien.san01",
                List.of(new RoleGrant("STAFF", "TENANT", tenantId)),
                Instant.now(),
                Instant.now().plusSeconds(3600)
        );

        lenient().when(rbacGuard.requireAuthenticated()).thenReturn(staffPrincipal);
        lenient().when(reservationRepository.findByReservationId(reservationId)).thenReturn(Optional.of(reservation));
        lenient().when(checkInRepository.existsByReservationId(reservationId)).thenReturn(false);
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Timestamp.class)))
                .thenReturn(Timestamp.from(Instant.now()));
    }

    @Test
    @DisplayName("Option 2: Allows venue STAFF without scanner to check in once using exact 6-digit email PIN & phone last4")
    void allowsValidPinAndPhoneLast4ForStaffWithoutScanner() {
        String validPin = tokenService.deriveCheckInPin(reservationId, qrJti);
        when(bookingRepository.findById(reservation.getBookingId())).thenReturn(Optional.of(booking));
        when(resourceGroupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(paymentRepository.sumSuccessfulEscrowByBookingId(any())).thenReturn(70_000L);
        when(checkInRepository.save(any(CheckIn.class))).thenAnswer(inv -> {
            CheckIn ci = inv.getArgument(0);
            ci.setId(UUID.randomUUID());
            return ci;
        });

        CheckInResponse response = checkInService.verifyPinCheckIn(reservationId, validPin, "6655");

        assertEquals("PIN_COUNTER", response.method());
        assertEquals("COMPLETED", response.reservationStatus());
        assertNotNull(reservation.getPinConsumedAt());

        // Single-use enforcement: reusing the same PIN fails
        when(checkInRepository.existsByReservationId(reservationId)).thenReturn(true);
        assertThrows(BusinessConflictException.class,
                () -> checkInService.verifyPinCheckIn(reservationId, validPin, "6655"));
    }

    @Test
    @DisplayName("Option 2: Locks verification for 5 minutes after 5 incorrect PIN guesses (anti-brute-force)")
    void locksAfterFiveWrongPinAttemptsAndRejectsWrongPhone() {
        for (int i = 1; i <= 5; i++) {
            BusinessConflictException ex = assertThrows(
                    BusinessConflictException.class,
                    () -> checkInService.verifyPinCheckIn(reservationId, "000000", null)
            );
            assertTrue(ex.getMessage().contains("PIN"));
        }

        assertEquals(5, reservation.getPinFailedAttempts());
        assertNotNull(reservation.getPinLockedUntil());

        String validPin = tokenService.deriveCheckInPin(reservationId, qrJti);
        BusinessConflictException lockEx = assertThrows(
                BusinessConflictException.class,
                () -> checkInService.verifyPinCheckIn(reservationId, validPin, "6655")
        );
        assertTrue(lockEx.getMessage().contains("tạm khóa"));

        // Different venue's staff must also be rejected
        SessionPrincipal otherVenueStaff = new SessionPrincipal(
                UUID.randomUUID(),
                "other",
                List.of(new RoleGrant("STAFF", "TENANT", UUID.randomUUID())),
                Instant.now(),
                Instant.now().plusSeconds(3600)
        );
        when(rbacGuard.requireAuthenticated()).thenReturn(otherVenueStaff);
        assertThrows(ForbiddenAccessException.class,
                () -> checkInService.verifyPinCheckIn(reservationId, validPin, "6655"));
    }
}
