package com.yieldengine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.PricingProperties;
import com.yieldengine.record.auth.*;
import com.yieldengine.record.finance.CreateCommissionRuleRequest;
import com.yieldengine.record.finance.ReconciliationReportResponse;
import com.yieldengine.record.ops.CancelBookingResponse;
import com.yieldengine.record.ops.CheckInResponse;
import com.yieldengine.record.ops.CreateMoMoPaymentRequest;
import com.yieldengine.record.ops.MoMoIpnCallbackRequest;
import com.yieldengine.utils.CryptoHashUtils;
import com.yieldengine.record.ops.OpenConversationRequest;
import com.yieldengine.record.ops.BookingPaymentStatus.State;
import com.yieldengine.record.vnpay.CreateVnPayPaymentRequest;
import com.yieldengine.record.ops.QrCodeResponse;
import com.yieldengine.record.ops.SendMessageRequest;
import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.dto.response.HoldSlotResponse;
import com.yieldengine.dto.response.PriceQuoteResponse;
import com.yieldengine.entity.CancellationPolicy;
import com.yieldengine.entity.CancellationPolicyTier;
import com.yieldengine.entity.CancellationPolicyTierId;
import com.yieldengine.entity.Conversation;
import com.yieldengine.enums.ReservationStatus;
import com.yieldengine.exception.*;
import com.yieldengine.security.AuthContext;
import com.yieldengine.security.SessionStorePort;
import com.yieldengine.service.*;
import com.yieldengine.service.policy.CancellationRefundPolicyEvaluator;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import com.yieldengine.service.vnpay.VnPayCryptoCodec;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "vnpay.tmn-code=ARENA_TEST", "vnpay.hash-secret=arena-test-vnpay-fixture-key",
        "momo.gateway.partner-code=ARENA_MOMO_TEST", "momo.gateway.access-key=arena-momo-fixture-access",
        "momo.gateway.secret-key=arena-momo-fixture-secret"
})
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("V3 Marketplace End-to-End & Domain Invariant Suite (PostgreSQL 16 + Redis 7)")
class V3MarketplaceIntegrationTest {

    private static final UUID DEFAULT_TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID DEFAULT_GROUP_ID = UUID.fromString("a0000000-0000-0000-0000-000000000001");

    @Autowired
    private AuthService authService;

    @Autowired
    private SessionStorePort sessionStore;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private PricingEngineService pricingEngineService;

    @Autowired
    private BookingOrchestratorService bookingOrchestratorService;

    @Autowired
    private CheckInService checkInService;

    @Autowired
    private VnPayPaymentService vnPay;

    @Autowired
    private VnPayCryptoCodec vnPayCodec;

    @Autowired
    private CheckoutPaymentService checkoutPayment;

    @Autowired
    private MockMvc mvc;


    @Autowired
    private ChatService chatService;

    @Autowired
    private FinanceLedgerService financeLedgerService;

    @Autowired
    private CancellationRefundPolicyEvaluator policyEvaluator;

    @Autowired
    private com.yieldengine.repository.TenantRepository tenantRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void clearSecurityContext() {
        AuthContext.clear();
    }

    @Test
    @Order(1)
    @DisplayName("BRD Worked Example: 35% Deposit & 11-Hour Cancellation Tier Boundary (11h01m vs 10h59m)")
    void testBrdWorkedCancellationBoundaryAndVenueOverride() {
        long lockedPrice = 100_000L;
        short depositPct = 35;
        long deposit = policyEvaluator.calculateDepositAmount(lockedPrice, depositPct);
        assertEquals(35_000L, deposit);

        UUID policyId = UUID.randomUUID();
        CancellationPolicy policy = CancellationPolicy.builder()
                .name("11h Cutoff Policy")
                .tenantId(DEFAULT_TENANT_ID)
                .tiers(List.of(CancellationPolicyTier.builder()
                        .id(new CancellationPolicyTierId(policyId, 11))
                        .refundPercent((short) 100)
                        .build()))
                .build();

        Map<String, Object> snapshot = policyEvaluator.createPolicySnapshot(policy, depositPct);
        Instant slotStart = Instant.parse("2026-12-10T11:00:00Z"); // 18:00 ICT

        // Case 1: 22 hours before start -> 100% refund (35,000 VND)
        var early = policyEvaluator.evaluate(deposit, snapshot, slotStart, slotStart.minus(Duration.ofHours(22)), false);
        assertEquals(35_000L, early.refundAmount());
        assertEquals(0L, early.forfeitedAmount());

        // Case 2: 11h 01m before start -> 100% refund (35,000 VND)
        var justBeforeCutoff = policyEvaluator.evaluate(deposit, snapshot, slotStart, slotStart.minus(Duration.ofMinutes(661)), false);
        assertEquals(35_000L, justBeforeCutoff.refundAmount());
        assertEquals(0L, justBeforeCutoff.forfeitedAmount());

        // Case 3: 10h 59m before start -> 0% refund, 35,000 VND forfeited
        var justAfterCutoff = policyEvaluator.evaluate(deposit, snapshot, slotStart, slotStart.minus(Duration.ofMinutes(659)), false);
        assertEquals(0L, justAfterCutoff.refundAmount());
        assertEquals(35_000L, justAfterCutoff.forfeitedAmount());

        // Case 4: Venue-initiated cancellation at 1h before start -> 100% refund (FR-22)
        var venueCancel = policyEvaluator.evaluate(deposit, snapshot, slotStart, slotStart.minus(Duration.ofHours(1)), true);
        assertEquals(35_000L, venueCancel.refundAmount());
        assertEquals(0L, venueCancel.forfeitedAmount());
    }

    @Test
    @Order(2)
    @DisplayName("State Machine & Purpose-Isolated Cryptographic Tokens Reject Cross-Use")
    void testReservationStateMachineAndKeyPurposeIsolation() {
        assertTrue(ReservationStatus.HELD.canTransitionTo(ReservationStatus.CONFIRMED));
        assertTrue(ReservationStatus.EXPIRED.canTransitionTo(ReservationStatus.CONFIRMED)); // Late payment re-grant
        assertFalse(ReservationStatus.COMPLETED.canTransitionTo(ReservationStatus.CANCELLED));
        assertThrows(IllegalStateException.class,
                () -> ReservationStatus.COMPLETED.assertCanTransitionTo(ReservationStatus.CANCELLED));

        PricingProperties props = new PricingProperties();
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        PriceLockTokenService tokenSvc = new PriceLockTokenService(props, mapper);

        String priceToken = tokenSvc.generateToken(
                "KEY_1", UUID.randomUUID(), DEFAULT_TENANT_ID, "u1", DEFAULT_GROUP_ID,
                Instant.now().plusSeconds(3600), 200_000L, Instant.now().plusSeconds(600)
        );
        // Price token must NEVER validate as a QR check-in token
        assertThrows(InvalidTokenSignatureException.class, () -> tokenSvc.verifyAndExtractQrToken(priceToken));
    }

    @Test
    @Order(3)
    @DisplayName("Identity, RBAC Scope Validation, Brute-Force Lockout & Soft-Delete Redis Session Revocation")
    void testIdentityRbacBruteForceAndSoftDelete() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        var adminReg = authService.register(new RegisterRequest(
                "admin_" + suffix, "admin_" + suffix + "@test.vn", "StrongPass123!", "System", "Admin", null));
        var admin2Reg = authService.register(new RegisterRequest(
                "admin2_" + suffix, "admin2_" + suffix + "@test.vn", "StrongPass123!", "Backup", "Admin", null));
        var playerReg = authService.register(new RegisterRequest(
                "player_" + suffix, "player_" + suffix + "@test.vn", "PlayerPass123!", "Minh", "Nguyen", null));

        var adminAuth = authService.login(new LoginRequest(adminReg.username(), "StrongPass123!"));
        var adminPrincipal = sessionStore.findSession(adminAuth.accessToken()).orElseThrow();

        // Grant ADMIN to both admins so we can also test scope rules
        authService.assignRole(adminReg.id(), new AssignRoleRequest("ADMIN", null), adminPrincipal);
        authService.assignRole(admin2Reg.id(), new AssignRoleRequest("ADMIN", null), adminPrincipal);

        // UC-03 Exc 3.1: Tenant role MANAGER without tenantId must be rejected
        assertThrows(IllegalArgumentException.class,
                () -> authService.assignRole(playerReg.id(), new AssignRoleRequest("MANAGER", null), adminPrincipal));

        // Login player and verify session exists in Redis
        var playerAuth = authService.login(new LoginRequest(playerReg.username(), "PlayerPass123!"));
        assertTrue(sessionStore.findSession(playerAuth.accessToken()).isPresent());

        // NFR-02: 5 consecutive wrong passwords lock the account temporarily
        var bruteTarget = authService.register(new RegisterRequest(
                "brute_" + suffix, "brute_" + suffix + "@test.vn", "CorrectPass123!", "Brute", "Target", null));
        for (int i = 0; i < 5; i++) {
            assertThrows(UnauthorizedException.class,
                    () -> authService.login(new LoginRequest(bruteTarget.username(), "WrongPass!")));
        }
        assertThrows(UnauthorizedException.class,
                () -> authService.login(new LoginRequest(bruteTarget.username(), "CorrectPass123!")));

        // FR-05 & NFR-05: Soft-delete (INACTIVE) immediately revokes Redis session & blocks login
        authService.changeAccountStatus(playerReg.id(), "INACTIVE", adminPrincipal);
        assertTrue(sessionStore.findSession(playerAuth.accessToken()).isEmpty(), "Redis session must be revoked on INACTIVE");
        assertThrows(UnauthorizedException.class,
                () -> authService.login(new LoginRequest(playerReg.username(), "PlayerPass123!")));
    }

    @Test
    @Order(4)
    @DisplayName("PostgreSQL 16 Physical Constraints: GiST Commission Overlap & Append-Only Ledger Trigger")
    void testPostgresGistCommissionOverlapAndAppendOnlyTriggers() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        var acctUser = authService.register(new RegisterRequest(
                "acct_" + suffix, "acct_" + suffix + "@test.vn", "AcctPass123!", "Ke", "Toan", null));

        var isolatedVenue = tenantRepository.save(com.yieldengine.entity.Tenant.builder()
                .code("VENUE_" + suffix.toUpperCase())
                .name("Isolated Commission Test Venue " + suffix)
                .status("ACTIVE")
                .build());

        // Create venue-wide commission rule (sportTypeId = NULL) for 2028
        Instant from1 = Instant.parse("2028-01-01T00:00:00Z");
        Instant to1 = Instant.parse("2028-07-01T00:00:00Z");
        financeLedgerService.createCommissionRule(new CreateCommissionRuleRequest(
                isolatedVenue.getId(), null, BigDecimal.valueOf(12.50), "COLLECTED_DEPOSIT", true, from1, to1
        ), acctUser.id());

        // Overlapping rule with sportTypeId = NULL must be rejected by PostgreSQL GiST COALESCE exclusion!
        Instant overlapFrom = Instant.parse("2028-05-01T00:00:00Z");
        Instant overlapTo = Instant.parse("2028-12-01T00:00:00Z");
        assertThrows(BusinessConflictException.class, () -> financeLedgerService.createCommissionRule(
                new CreateCommissionRuleRequest(
                        isolatedVenue.getId(), null, BigDecimal.valueOf(15.00), "COLLECTED_DEPOSIT", true, overlapFrom, overlapTo
                ), acctUser.id()
        ));
    }

    @Test
    @Order(5)
    @DisplayName("Full E2E Flow: Discovery -> Quote -> Idempotent Hold -> Webhook -> QR Scan -> Double-Entry Ledger & Chat")
    void testEndToEndBookingDepositQrCheckInChatAndLedger() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        // 1. Setup Player, Venue1 Staff, Venue2 Staff, and Accountant
        var setupAdmin = authService.register(new RegisterRequest(
                "sys_" + suffix, "sys_" + suffix + "@test.vn", "AdminPass123!", "Sys", "Admin", null));
        var dummyPrincipal = new com.yieldengine.record.security.SessionPrincipal(
                setupAdmin.id(), setupAdmin.username(),
                List.of(new com.yieldengine.record.security.RoleGrant("ADMIN", "PLATFORM", null)),
                Instant.now(), Instant.now().plusSeconds(3600)
        );

        var player = authService.register(new RegisterRequest(
                "p_" + suffix, "p_" + suffix + "@test.vn", "Pass12345!", "Player", "One", null));
        var manager = authService.register(new RegisterRequest(
                "m_" + suffix, "m_" + suffix + "@test.vn", "Pass12345!", "Venue", "Manager", null));
        authService.assignRole(manager.id(), new AssignRoleRequest("MANAGER", DEFAULT_TENANT_ID), dummyPrincipal);

        var managerAuth = authService.login(new LoginRequest(manager.username(), "Pass12345!"));
        var managerPrincipal = sessionStore.findSession(managerAuth.accessToken()).orElseThrow();
        var staff = authService.createVenueStaff(DEFAULT_TENANT_ID, new CreateStaffRequest(
                "s_" + suffix, "s_" + suffix + "@test.vn", "Pass12345!", "Court", "Staff"), managerPrincipal);

        var staffAuth = authService.login(new LoginRequest(staff.username(), "Pass12345!"));
        var staffPrincipal = sessionStore.findSession(staffAuth.accessToken()).orElseThrow();
        var playerAuth = authService.login(new LoginRequest(player.username(), "Pass12345!"));
        var playerPrincipal = sessionStore.findSession(playerAuth.accessToken()).orElseThrow();

        // 2. Create a future slot & verify published listing discovery
        Instant slotStart = Instant.now().plus(Duration.ofDays(3)).truncatedTo(ChronoUnit.HOURS)
                .plusSeconds((suffix.hashCode() & 0x7f) * 3600L);
        Instant slotEnd = slotStart.plus(Duration.ofHours(1));
        inventoryService.createTimeSlot(CreateTimeSlotRequest.builder()
                .groupId(DEFAULT_GROUP_ID)
                .slotStart(slotStart)
                .slotEnd(slotEnd)
                .totalCapacity(10)
                .contextMultiplier(BigDecimal.ONE)
                .build());

        var listings = inventoryService.browsePublishedListings("PICKLEBALL", DEFAULT_TENANT_ID, slotStart.minusSeconds(60), slotEnd.plusSeconds(60));
        assertFalse(listings.isEmpty());

        // 3. Lock dynamic price & Hold court with Idempotency-Key
        AuthContext.set(playerPrincipal, playerAuth.accessToken());
        PriceQuoteResponse quote = pricingEngineService.getPriceQuote(DEFAULT_GROUP_ID, slotStart, player.id().toString());
        assertTrue(quote.getCurrentPrice() >= 120_000L && quote.getCurrentPrice() <= 350_000L);

        String idemKey = "idem-" + UUID.randomUUID();
        HoldSlotRequest holdReq = HoldSlotRequest.builder()
                .groupId(DEFAULT_GROUP_ID)
                .slotStart(slotStart)
                .userId(player.id().toString())
                .priceLockToken(quote.getPriceLockToken())
                .build();

        HoldSlotResponse held = bookingOrchestratorService.holdSlot(holdReq, idemKey);
        assertEquals("HELD", held.getStatus());
        assertEquals((quote.getCurrentPrice() * 35) / 100L, held.getDepositAmount());

        // Idempotent retry with exact same key + payload returns identical reservationId
        HoldSlotResponse retryHeld = bookingOrchestratorService.holdSlot(holdReq, idemKey);
        assertEquals(held.getReservationId(), retryHeld.getReservationId());

        // Reuse same Idempotency-Key with different payload -> 422 Unprocessable Entity
        HoldSlotRequest tamperedHold = HoldSlotRequest.builder()
                .groupId(DEFAULT_GROUP_ID)
                .slotStart(slotStart)
                .userId("different-user")
                .priceLockToken(quote.getPriceLockToken())
                .build();
        assertThrows(IdempotencyConflictException.class,
                () -> bookingOrchestratorService.holdSlot(tamperedHold, idemKey));

        // A provider session and browser return leave the booking on hold.
        var paymentRequest = new CreateVnPayPaymentRequest(held.getReservationId(), held.getDepositAmount(),
                null, "vn", null, null, null, null, null, null, null, null, null);
        assertEquals(State.NOT_STARTED, checkoutPayment.getStatus(held.getReservationId(), player.id()).paymentStatus());
        assertThrows(ForbiddenAccessException.class, () -> checkoutPayment.getStatus(held.getReservationId(), manager.id()));
        assertThrows(ForbiddenAccessException.class, () -> vnPay.createPaymentUrl(paymentRequest, "127.0.0.1", manager.id()));
        var attempt = vnPay.createPaymentUrl(paymentRequest, "127.0.0.1", player.id());
        assertEquals(State.PENDING, checkoutPayment.getStatus(held.getReservationId(), player.id()).paymentStatus());
        assertThrows(BusinessConflictException.class, () -> vnPay.createPaymentUrl(paymentRequest, "127.0.0.1", player.id()));

        var rejected = signedVnPayFixture(attempt.txnRef(), attempt.vnpAmount(), "24", "02");
        assertFalse(vnPay.handleReturnCallback(rejected).paymentSucceeded());
        assertEquals(State.PENDING, checkoutPayment.getStatus(held.getReservationId(), player.id()).paymentStatus());
        assertEquals("00", vnPay.handleIpnCallback(rejected).rspCode());
        assertEquals(State.FAILED, checkoutPayment.getStatus(held.getReservationId(), player.id()).paymentStatus());
        assertThrows(BusinessConflictException.class, () -> checkInService.issueOrGetQrCode(held.getReservationId()));

        var retry = vnPay.createPaymentUrl(paymentRequest, "127.0.0.1", player.id());
        var reportedPaid = signedVnPayFixture(retry.txnRef(), retry.vnpAmount(), "00", "00");
        assertFalse(vnPay.handleReturnCallback(reportedPaid).paymentSucceeded());
        var pending = checkoutPayment.getStatus(held.getReservationId(), player.id());
        assertEquals(State.PENDING, pending.paymentStatus());
        assertEquals(retry.amountVnd(), pending.requestedAmount());
        assertEquals(0, pending.paidAmount());
        assertThrows(BusinessConflictException.class, () -> checkInService.issueOrGetQrCode(held.getReservationId()));

        assertEquals("00", vnPay.handleIpnCallback(reportedPaid).rspCode());
        assertEquals("02", vnPay.handleIpnCallback(reportedPaid).rspCode());
        var verified = checkoutPayment.getStatus(held.getReservationId(), player.id());
        assertEquals(State.VERIFIED, verified.paymentStatus());
        assertEquals(held.getDepositAmount(), verified.paidAmount());
        assertEquals(retry.txnRef(), verified.providerReference());

        // 5. Player retrieves QR Code
        QrCodeResponse qr = checkInService.issueOrGetQrCode(held.getReservationId());
        assertNotNull(qr.qrToken());

        // 6. Venue Staff scans QR -> COMPLETED; Second scan -> 409 Conflict
        AuthContext.set(staffPrincipal, staffAuth.accessToken());
        CheckInResponse checkIn = checkInService.scanQrCheckIn(qr.qrToken());
        assertEquals("COMPLETED", checkIn.reservationStatus());
        assertThrows(BusinessConflictException.class, () -> checkInService.scanQrCheckIn(qr.qrToken()));

        // 7. Chat between Player and Staff (when staff chat enabled vs disabled)
        AuthContext.set(playerPrincipal, playerAuth.accessToken());
        Conversation conv = chatService.openOrGetConversation(new OpenConversationRequest(DEFAULT_TENANT_ID, held.getBookingId()));
        var m1 = chatService.sendMessage(conv.getId(), new SendMessageRequest("Cho mình hỏi sân có cho thuê vợt không?"));
        assertNotNull(m1.getMessageId());

        // Append-only trigger on messages must reject UPDATE
        assertThrows(Exception.class,
                () -> jdbcTemplate.update("UPDATE messages SET body = 'edited' WHERE id = ?", m1.getMessageId()));

        AuthContext.set(staffPrincipal, staffAuth.accessToken());
        var m2 = chatService.sendMessage(conv.getId(), new SendMessageRequest("Dạ sân có sẵn vợt cho thuê ạ!"));
        assertEquals("STAFF", m2.getSenderRole());

        // 8. Verify Double-Entry Ledger Balance & Append-Only Trigger on ledger_entries
        ReconciliationReportResponse recon = financeLedgerService.reconcile(
                DEFAULT_TENANT_ID, Instant.now().minusSeconds(3600), Instant.now().plusSeconds(3600)
        );
        assertTrue(recon.doubleEntryBalanced(), "Double-entry ledger debits must equal credits");
        assertTrue(recon.totalPlatformCommission() > 0, "Platform commission must be recorded on completed rental");
        assertTrue(recon.totalVenuePayable() > 0, "Venue net payable must be recorded on completed rental");

        assertThrows(Exception.class,
                () -> jdbcTemplate.update("DELETE FROM ledger_entries WHERE reservation_id = ?", held.getReservationId()));
    }
    @Test
    @Order(6)
    void retiredCheckoutRoutesCannotWritePaymentState() throws Exception {
        for (String route : List.of("/api/v1/payments/webhook", "/api/v1/bookings/" + UUID.randomUUID() + "/confirm")) {
            int code = mvc.perform(MockMvcRequestBuilders.post(route))
                    .andReturn().getResponse().getStatus();
            assertTrue(code >= 400, "Retired checkout routes must reject requests");
        }
    }

    @Test
    @Order(7)
    void momoIpnRestoresOnlyTheRegisteredPaymentAttempt() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        var player = authService.register(new RegisterRequest(
                "momo_" + suffix, "momo_" + suffix + "@example.test", "Pass12345!", "Test", "Player", null));
        var login = authService.login(new LoginRequest(player.username(), "Pass12345!"));
        AuthContext.set(sessionStore.findSession(login.accessToken()).orElseThrow(), login.accessToken());
        Instant start = Instant.now().plusSeconds(21600).truncatedTo(ChronoUnit.MILLIS);
        inventoryService.createTimeSlot(CreateTimeSlotRequest.builder().groupId(DEFAULT_GROUP_ID)
                .slotStart(start).slotEnd(start.plusSeconds(3600)).totalCapacity(10).contextMultiplier(BigDecimal.ONE).build());
        var quote = pricingEngineService.getPriceQuote(DEFAULT_GROUP_ID, start, player.id().toString());
        var hold = bookingOrchestratorService.holdSlot(HoldSlotRequest.builder().groupId(DEFAULT_GROUP_ID)
                .slotStart(start).userId(player.id().toString()).priceLockToken(quote.getPriceLockToken()).build());
        var create = new CreateMoMoPaymentRequest(hold.getReservationId(), hold.getDepositAmount(),
                null, null, null, false, null, null, null);
        String orderId = "TEST_" + suffix;
        bookingOrchestratorService.beginMoMoPayment(create, player.id(), orderId);
        assertEquals(State.PENDING, checkoutPayment.getStatus(hold.getReservationId(), player.id()).paymentStatus());

        assertEquals(204, sendMoMoFixture(hold, orderId, 7000, 0));
        assertEquals(State.PENDING, checkoutPayment.getStatus(hold.getReservationId(), player.id()).paymentStatus());
        assertEquals(204, sendMoMoFixture(hold, orderId, 0, 123456789));
        assertEquals(204, sendMoMoFixture(hold, orderId, 0, 123456789));
        var status = checkoutPayment.getStatus(hold.getReservationId(), player.id());
        assertEquals(State.VERIFIED, status.paymentStatus());
        assertEquals(hold.getDepositAmount(), status.paidAmount());
        assertEquals(orderId, status.providerReference());
    }

    private int sendMoMoFixture(HoldSlotResponse hold, String order, int resultCode, long transactionId) throws Exception {
        String extraData = java.util.Base64.getEncoder().encodeToString(
                hold.getReservationId().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        long time = Instant.now().toEpochMilli();
        long amount = hold.getDepositAmount();
        String input = "accessKey=arena-momo-fixture-access&amount=" + amount + "&extraData=" + extraData
                + "&message=Fixture&orderId=" + order + "&orderInfo=Dat san&orderType=momo_wallet"
                + "&partnerCode=ARENA_MOMO_TEST&payType=qr&requestId=" + order + "&responseTime=" + time
                + "&resultCode=" + resultCode + "&transId=" + transactionId;
        String signature = CryptoHashUtils.hmacSha256Hex(input, "arena-momo-fixture-secret");
        var notice = new MoMoIpnCallbackRequest("ARENA_MOMO_TEST", order, order, amount, "Dat san", "momo_wallet",
                transactionId, resultCode, "Fixture", "qr", time, extraData, signature, null);
        return mvc.perform(MockMvcRequestBuilders.post("/api/v1/payments/momo/ipn")
                .contentType("application/json").content(new ObjectMapper().writeValueAsString(notice)))
                .andReturn().getResponse().getStatus();
    }

    private Map<String, String> signedVnPayFixture(String ref, long amount, String code, String status) {
        Map<String, String> params = new java.util.LinkedHashMap<>(Map.of(
                "vnp_TmnCode", "ARENA_TEST", "vnp_TxnRef", ref, "vnp_Amount", String.valueOf(amount),
                "vnp_ResponseCode", code, "vnp_TransactionStatus", status, "vnp_TransactionNo", "987654321"));
        String callback = vnPayCodec.buildSignedPaymentUrl("https://example.test", params, "arena-test-vnpay-fixture-key");
        params.put("vnp_SecureHash", callback.substring(callback.lastIndexOf('=') + 1));
        return params;
    }

}
