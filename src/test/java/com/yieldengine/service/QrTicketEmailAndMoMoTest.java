package com.yieldengine.service;

import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetupTest;
import com.yieldengine.record.ops.EmailDispatchResult;
import com.yieldengine.entity.*;
import com.yieldengine.repository.*;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("QR Ticket Email Dispatch (SMTP + ZXing PNG) & MoMo HMAC Signature Tests")
class QrTicketEmailAndMoMoTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private ResourceGroupRepository resourceGroupRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private PriceLockTokenService priceLockTokenService;
    @Mock private PricingEngineService pricingEngineService;

    private GreenMail greenMail;
    private QrTicketEmailService emailService;

    @BeforeEach
    void setUp() {
        greenMail = new GreenMail(ServerSetupTest.SMTP);
        greenMail.start();

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost("localhost");
        sender.setPort(greenMail.getSmtp().getPort());

        TicketPassService ticketPassService = new TicketPassService(
                resourceGroupRepository,
                bookingRepository,
                paymentRepository,
                priceLockTokenService,
                pricingEngineService
        );
        emailService = new QrTicketEmailService(
                sender,
                reservationRepository,
                ticketPassService,
                new TicketEmailTemplateRenderer(),
                "arenapulse-tickets@arenapulse.vn",
                "",
                true
        );
    }

    @AfterEach
    void tearDown() {
        if (greenMail != null) {
            greenMail.stop();
        }
    }

    @Test
    @DisplayName("Dispatches HTML email with ZXing PNG QR attachment over real SMTP to munonguyen2005@gmail.com")
    void sendsRealMimeQrTicketEmailToMunonguyen2005() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID groupId = UUID.randomUUID();
        UUID bookingId = UUID.randomUUID();
        UUID reservationId = UUID.randomUUID();
        UUID qrJti = UUID.randomUUID();
        Instant slotStart = Instant.now().plus(2, ChronoUnit.DAYS);

        Tenant tenant = Tenant.builder().id(tenantId).code("CV_HN").name("ArenaPulse Hà Nội").address("Số 1 Đại Cồ Việt").build();
        ResourceGroup group = ResourceGroup.builder()
                .tenant(tenant).code("PB_01").name("Cụm 10 Sân Pickleball").noshowGraceMinutes(15)
                .basePrice(200_000L).minPrice(120_000L).maxPrice(350_000L).build();
        group.setId(groupId);

        Unit unit = Unit.builder().tenantId(tenantId).resourceGroup(group).unitNumber("SAN_04").status("ACTIVE").build();
        Booking booking = Booking.builder()
                .tenant(tenant).userId(UUID.randomUUID())
                .contactName("Nguyễn Muno").contactEmail("munonguyen2005@gmail.com")
                .totalAmount(200_000L).depositTotal(70_000L).build();
        booking.setId(bookingId);

        Reservation res = Reservation.builder()
                .id(new ReservationId(reservationId, slotStart))
                .tenantId(tenantId).groupId(groupId).bookingId(bookingId)
                .unit(unit).status("CONFIRMED").lockedPrice(200_000L)
                .depositAmount(70_000L).qrJti(qrJti).build();

        Payment deposit = Payment.builder()
                .tenant(tenant).booking(booking).provider("MOMO_WALLET")
                .providerRef("MOMO_123").paymentType("DEPOSIT").amount(70_000L).status("SUCCESS").build();

        when(reservationRepository.findByReservationId(reservationId)).thenReturn(Optional.of(res));
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(resourceGroupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(paymentRepository.sumSuccessfulPaidByBookingId(bookingId)).thenReturn(70_000L);
        when(pricingEngineService.getActiveQrKeyId()).thenReturn("QR_KEY_2026_V1");
        when(priceLockTokenService.generateQrToken(any(), any(), any(), any(), any(), any()))
                .thenReturn("eyJwbGFjZWhvbGRlciI6InFyIn0.SIGNATURE_HMAC");
        when(priceLockTokenService.deriveCheckInPin(reservationId, qrJti)).thenReturn("482913");

        EmailDispatchResult result =
                emailService.sendQrTicketEmailForReservation(reservationId, "munonguyen2005@gmail.com", "Nguyễn Muno");

        assertTrue(result.sentOverSmtp());
        assertEquals("munonguyen2005@gmail.com", result.recipientEmail());
        assertTrue(result.qrPngBytes() > 200);

        MimeMessage[] received = greenMail.getReceivedMessages();
        assertEquals(1, received.length);
        assertEquals("munonguyen2005@gmail.com", received[0].getAllRecipients()[0].toString());
        assertTrue(received[0].getSubject().contains("SAN_04"));

        assertInstanceOf(MimeMultipart.class, received[0].getContent());
        MimeMultipart rootMultipart = (MimeMultipart) received[0].getContent();
        assertTrue(rootMultipart.getCount() >= 2);
    }

    @Test
    @DisplayName("Dispatches numeric PIN email without QR image or attachment for PIN_COUNTER venues")
    void sendsPinOnlyEmailWithoutQrForNoScannerVenue() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID groupId = UUID.randomUUID();
        UUID bookingId = UUID.randomUUID();
        UUID reservationId = UUID.randomUUID();
        UUID qrJti = UUID.randomUUID();
        Instant slotStart = Instant.now().plus(2, ChronoUnit.DAYS);

        Tenant tenant = Tenant.builder().id(tenantId).code("PIN_SAN").name("Sân Tự Quản").address("Hà Nội")
                .checkinMode("PIN_COUNTER").build();
        ResourceGroup group = ResourceGroup.builder()
                .tenant(tenant).code("PB_PIN").name("Cụm Không Máy Quét").noshowGraceMinutes(15)
                .basePrice(180_000L).minPrice(120_000L).maxPrice(260_000L).checkinMode("PIN_COUNTER").build();
        group.setId(groupId);

        Unit unit = Unit.builder().tenantId(tenantId).resourceGroup(group).unitNumber("SAN_02").status("ACTIVE").build();
        Booking booking = Booking.builder()
                .tenant(tenant).userId(UUID.randomUUID())
                .contactName("Trần Hoàng Bách").contactEmail("bach@gmail.com")
                .totalAmount(180_000L).depositTotal(60_000L).build();
        booking.setId(bookingId);

        Reservation res = Reservation.builder()
                .id(new ReservationId(reservationId, slotStart))
                .tenantId(tenantId).groupId(groupId).bookingId(bookingId)
                .unit(unit).status("CONFIRMED").lockedPrice(180_000L)
                .depositAmount(60_000L).qrJti(qrJti).build();

        when(reservationRepository.findByReservationId(reservationId)).thenReturn(Optional.of(res));
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(resourceGroupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(paymentRepository.sumSuccessfulPaidByBookingId(bookingId)).thenReturn(60_000L);
        when(priceLockTokenService.deriveCheckInPin(reservationId, qrJti)).thenReturn("651905");

        EmailDispatchResult result =
                emailService.sendQrTicketEmailForReservation(reservationId, "bach@gmail.com", "Trần Hoàng Bách");

        assertTrue(result.sentOverSmtp());
        assertEquals(0, result.qrPngBytes());
        MimeMessage[] received = greenMail.getReceivedMessages();
        assertEquals(1, received.length);
        assertTrue(received[0].getSubject().contains("Mã số nhận sân"));
        String body = received[0].getContent().toString();
        assertTrue(body.contains("651905"));
        assertFalse(body.contains("arenapulseTicketQr"));
    }

    @Test
    @DisplayName("MoMo v2 HMAC-SHA256 IPN signature verification accepts authentic signature and blocks tampering")
    void verifiesMoMoHmacSignatureStrictly() {
        com.yieldengine.config.MoMoGatewayProperties props = new com.yieldengine.config.MoMoGatewayProperties();
        props.setPartnerCode("MOMO_TEST");
        props.setAccessKey("ACCESS_TEST");
        props.setSecretKey("SECRET_KEY_2026");
        props.setRedirectUrl("http://localhost:5174/checkout");
        props.setIpnUrl("http://localhost:8080/ipn");
        props.setLiveHttpEnabled(false);

        MoMoPaymentGatewayService momo = new MoMoPaymentGatewayService(
                props,
                new com.yieldengine.validate.MoMoPaymentValidator(),
                org.mapstruct.factory.Mappers.getMapper(com.yieldengine.mapper.MoMoGatewayMapper.class),
                new com.fasterxml.jackson.databind.ObjectMapper(),
                java.net.http.HttpClient.newHttpClient()
        );
        UUID resId = UUID.randomUUID();
        var init = momo.createPaymentSession(resId, 70_000L, "Dat san", "");
        assertNotNull(init.signature());

        String ipnRaw = "accessKey=ACCESS_TEST&amount=70000&extraData=&message=Successful.&orderId=" + init.orderId()
                + "&orderInfo=Dat san&orderType=momo_wallet&partnerCode=MOMO_TEST&payType=qr&requestId=" + init.requestId()
                + "&responseTime=1795650000&resultCode=0&transId=999888777";
        String validIpnSig = com.yieldengine.utils.CryptoHashUtils.hmacSha256Hex(ipnRaw, "SECRET_KEY_2026");

        var validIpnReq = new com.yieldengine.record.ops.MoMoIpnCallbackRequest(
                "MOMO_TEST", init.orderId(), init.requestId(), 70_000L,
                "Dat san", "momo_wallet", 999888777L, 0, "Successful.", "qr", 1795650000L, "", validIpnSig, resId
        );
        assertTrue(momo.verifyIpnSignature(validIpnReq));

        // Tampered amount must fail HMAC
        var tamperedIpnReq = new com.yieldengine.record.ops.MoMoIpnCallbackRequest(
                "MOMO_TEST", init.orderId(), init.requestId(), 1_000L,
                "Dat san", "momo_wallet", 999888777L, 0, "Successful.", "qr", 1795650000L, "", validIpnSig, resId
        );
        assertFalse(momo.verifyIpnSignature(tamperedIpnReq));
    }

    @Test
    @DisplayName("Parses live MoMo v2 PayGate JSON response via MapStruct DTOs and enforces validator bounds")
    @SuppressWarnings("unchecked")
    void parsesLiveMoMoHttpCreateResponseAndRejectsErrorResultCode() throws Exception {
        java.net.http.HttpClient mockHttp = org.mockito.Mockito.mock(java.net.http.HttpClient.class);
        java.net.http.HttpResponse<String> okResp = org.mockito.Mockito.mock(java.net.http.HttpResponse.class);
        when(okResp.statusCode()).thenReturn(200);
        when(okResp.body()).thenReturn("""
                {
                  "partnerCode": "MOMOBKUN20180529",
                  "orderId": "ORDER_123",
                  "requestId": "REQ_123",
                  "amount": 50000,
                  "resultCode": 0,
                  "message": "Thành công.",
                  "payUrl": "https://test-payment.momo.vn/v2/gateway/pay?t=ABC",
                  "qrCodeUrl": "00020101021226110007vn.momo...",
                  "deeplink": "momo://app?action=payWithApp",
                  "signature": "sig_hex_123"
                }
                """);
        when(mockHttp.send(any(java.net.http.HttpRequest.class), any(java.net.http.HttpResponse.BodyHandler.class)))
                .thenReturn(okResp);

        com.yieldengine.config.MoMoGatewayProperties liveProps = new com.yieldengine.config.MoMoGatewayProperties();
        MoMoPaymentGatewayService liveService = new MoMoPaymentGatewayService(
                liveProps,
                new com.yieldengine.validate.MoMoPaymentValidator(),
                org.mapstruct.factory.Mappers.getMapper(com.yieldengine.mapper.MoMoGatewayMapper.class),
                new com.fasterxml.jackson.databind.ObjectMapper(),
                mockHttp
        );

        var session = liveService.createPaymentSession(UUID.randomUUID(), 50_000L, "Dat san test", "");
        assertTrue(session.liveGatewayResponse());
        assertEquals(0, session.resultCode());
        assertEquals("https://test-payment.momo.vn/v2/gateway/pay?t=ABC", session.payUrl());
        assertTrue(session.qrCodeUrl().startsWith("000201"));

        // Validator blocks amount below MoMo minimum threshold before calling gateway
        assertThrows(IllegalArgumentException.class,
                () -> liveService.createPaymentSession(UUID.randomUUID(), 100L, "Too small", ""));

        java.net.http.HttpResponse<String> errResp = org.mockito.Mockito.mock(java.net.http.HttpResponse.class);
        when(errResp.statusCode()).thenReturn(200);
        when(errResp.body()).thenReturn("""
                {"resultCode": 20, "message": "Số tiền không hợp lệ."}
                """);
        when(mockHttp.send(any(java.net.http.HttpRequest.class), any(java.net.http.HttpResponse.BodyHandler.class)))
                .thenReturn(errResp);

        IllegalStateException thrown = assertThrows(IllegalStateException.class,
                () -> liveService.createPaymentSession(UUID.randomUUID(), 50_000L, "Invalid gateway state", ""));
        assertTrue(thrown.getMessage().contains("Số tiền không hợp lệ"));
    }
}
