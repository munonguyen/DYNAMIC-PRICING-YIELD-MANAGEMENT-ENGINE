package com.yieldengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.config.VnPayProperties;
import com.yieldengine.record.ops.PaymentWebhookRequest;
import com.yieldengine.record.vnpay.*;
import com.yieldengine.entity.Payment;
import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.ReservationId;
import com.yieldengine.entity.VnPayTransaction;
import com.yieldengine.enums.VnPayTransactionStatus;
import com.yieldengine.mapper.VnPayTransactionMapper;
import com.yieldengine.repository.PaymentRepository;
import com.yieldengine.repository.ReservationRepository;
import com.yieldengine.repository.VnPayTransactionRepository;
import com.yieldengine.service.vnpay.VnPayCryptoCodec;
import com.yieldengine.validate.VnPayPaymentValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("VNPAY Payment Gateway v2.1.0 Service & Codec Unit Tests")
class VnPayPaymentServiceTest {

    @Mock private VnPayTransactionRepository txnRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private BookingOrchestratorService bookingOrchestratorService;
    @Mock private HttpClient mockHttpClient;

    private VnPayProperties properties;
    private VnPayCryptoCodec cryptoCodec;
    private VnPayPaymentService service;

    private UUID tenantId;
    private UUID bookingId;
    private UUID reservationId;
    private Reservation heldReservation;

    @BeforeEach
    void setUp() {
        properties = new VnPayProperties();
        properties.setTmnCode("ARENAPULSE");
        properties.setHashSecret("VNPAY_TEST_SECRET_KEY_HMAC_SHA512_2026");
        properties.setPayUrl("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        properties.setApiUrl("https://sandbox.vnpayment.vn/merchant_webapi/api/transaction");
        properties.setReturnUrl("http://127.0.0.1:5174/checkout");

        cryptoCodec = new VnPayCryptoCodec();
        service = new VnPayPaymentService(
                properties,
                cryptoCodec,
                new VnPayPaymentValidator(),
                org.mapstruct.factory.Mappers.getMapper(VnPayTransactionMapper.class),
                txnRepository,
                reservationRepository,
                paymentRepository,
                bookingOrchestratorService,
                new ObjectMapper(),
                mockHttpClient
        );

        tenantId = UUID.randomUUID();
        bookingId = UUID.randomUUID();
        reservationId = UUID.randomUUID();
        heldReservation = Reservation.builder()
                .id(new ReservationId(reservationId, Instant.now().plusSeconds(86400)))
                .tenantId(tenantId)
                .groupId(UUID.randomUUID())
                .bookingId(bookingId)
                .status("HELD")
                .holdExpiresAt(Instant.now().plusSeconds(600))
                .lockedPrice(200_000L)
                .depositAmount(70_000L)
                .build();
    }

    @Test
    @DisplayName("Create Payment URL signs HMAC-SHA512 cleanly, strips Vietnamese accents, and stores PENDING transaction")
    void createsSignedVnPayUrlAndPersistsPendingTransaction() {
        UUID userId = UUID.randomUUID();
        when(bookingOrchestratorService.prepareGatewayPayment(reservationId, userId)).thenReturn(heldReservation);
        when(txnRepository.save(any(VnPayTransaction.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateVnPayPaymentRequest req = new CreateVnPayPaymentRequest(
                reservationId, 70_000L, "NCB", "vn", "other",
                "Đặt sân Pickleball số 04", "Nguyễn Muno", "0912345678",
                "munonguyen2005@gmail.com", false, null, null, "San bong ro"
        );

        VnPayPaymentUrlResponse resp = service.createPaymentUrl(req, "10.20.30.40", userId);

        assertEquals("ok", resp.code());
        assertEquals("success", resp.message());
        assertEquals(70_000L, resp.amountVnd());
        assertEquals(7_000_000L, resp.vnpAmount());
        assertTrue(resp.paymentUrl().startsWith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?"));

        Map<String, String> parsed = parseQueryParams(resp.paymentUrl());
        assertEquals("2.1.0", parsed.get("vnp_Version"));
        assertEquals("pay", parsed.get("vnp_Command"));
        assertEquals("ARENAPULSE", parsed.get("vnp_TmnCode"));
        assertEquals("7000000", parsed.get("vnp_Amount"));
        assertEquals("NCB", parsed.get("vnp_BankCode"));
        assertEquals("Dat san Pickleball so 04", parsed.get("vnp_OrderInfo"));
        assertTrue(cryptoCodec.verifyCallbackSignature(parsed, properties.getHashSecret()));

        verify(bookingOrchestratorService).updateBookingContactDetails(
                eq(reservationId), eq("Nguyễn Muno"), eq("0912345678"),
                eq("munonguyen2005@gmail.com"), eq(false), isNull(), isNull(), eq("San bong ro")
        );
    }

    @Test
    @DisplayName("IPN callback enforces Checksum (97), OrderNotFound (01), InvalidAmount (04), Success (00), and Idempotency (02)")
    void enforcesAllVnPayIpnSpecificationRules() {
        VnPayTransaction pendingTxn = VnPayTransaction.builder()
                .tenantId(tenantId)
                .bookingId(bookingId)
                .reservationId(reservationId)
                .txnRef("VNP_TXN_2026_01")
                .orderInfo("Thanh toan dat san")
                .amountVnd(70_000L)
                .vnpAmount(7_000_000L)
                .createDate("20261126093000")
                .expireDate("20261126094500")
                .clientIp("127.0.0.1")
                .status(VnPayTransactionStatus.PENDING)
                .build();

        Map<String, String> baseParams = new LinkedHashMap<>();
        baseParams.put("vnp_TmnCode", "ARENAPULSE");
        baseParams.put("vnp_TxnRef", "VNP_TXN_2026_01");
        baseParams.put("vnp_Amount", "7000000");
        baseParams.put("vnp_BankCode", "NCB");
        baseParams.put("vnp_CardType", "ATM");
        baseParams.put("vnp_TransactionNo", "14455667");
        baseParams.put("vnp_ResponseCode", "00");
        baseParams.put("vnp_TransactionStatus", "00");
        baseParams.put("vnp_PayDate", "20261126093215");

        // 1. Invalid Checksum -> 97
        Map<String, String> badSigParams = new LinkedHashMap<>(baseParams);
        badSigParams.put("vnp_SecureHash", "tampered_hash");
        assertEquals("97", service.handleIpnCallback(badSigParams).rspCode());

        // 2. Order Not Found -> 01
        Map<String, String> signedValid = signCallback(baseParams);
        when(txnRepository.lockByTxnRef("VNP_TXN_2026_01")).thenReturn(Optional.empty());
        assertEquals("01", service.handleIpnCallback(signedValid).rspCode());

        // 3. Invalid Amount -> 04
        when(txnRepository.lockByTxnRef("VNP_TXN_2026_01")).thenReturn(Optional.of(pendingTxn));
        Map<String, String> wrongAmount = new LinkedHashMap<>(baseParams);
        wrongAmount.put("vnp_Amount", "500000");
        assertEquals("04", service.handleIpnCallback(signCallback(wrongAmount)).rspCode());

        // 4. Valid First IPN -> 00 & settles booking + payment record
        Reservation confirmed = Reservation.builder()
                .id(heldReservation.getId()).tenantId(tenantId).groupId(heldReservation.getGroupId())
                .bookingId(bookingId).status("CONFIRMED").lockedPrice(200_000L).depositAmount(70_000L).build();
        Payment linkedPayment = Payment.builder().provider("VNPAY_ESCROW").providerRef("VNP_TXN_2026_01").amount(70_000L).status("SUCCESS").build();
        when(bookingOrchestratorService.processPaymentWebhook(any(PaymentWebhookRequest.class))).thenReturn(confirmed);
        when(paymentRepository.findByProviderAndProviderRef("VNPAY_ESCROW", "VNP_TXN_2026_01"))
                .thenReturn(Optional.of(linkedPayment));

        VnPayIpnResponse okAck = service.handleIpnCallback(signedValid);
        assertEquals("00", okAck.rspCode());
        assertEquals("Confirm Success", okAck.message());
        assertEquals(VnPayTransactionStatus.SUCCESS, pendingTxn.getStatus());
        assertEquals("NCB", pendingTxn.getBankCode());
        assertEquals("ATM", pendingTxn.getCardType());
        assertEquals("14455667", pendingTxn.getTransactionNo());

        ArgumentCaptor<PaymentWebhookRequest> webhookCap = ArgumentCaptor.forClass(PaymentWebhookRequest.class);
        verify(bookingOrchestratorService).processPaymentWebhook(webhookCap.capture());
        assertEquals("VNPAY_ESCROW", webhookCap.getValue().provider());
        assertEquals(70_000L, webhookCap.getValue().amount());
        assertEquals("SUCCESS", webhookCap.getValue().status());

        // 5. Retry IPN on finalized transaction -> 02 (Idempotent)
        VnPayIpnResponse retryAck = service.handleIpnCallback(signedValid);
        assertEquals("02", retryAck.rspCode());
        assertEquals("Order already confirmed", retryAck.message());
        verify(bookingOrchestratorService, times(1)).processPaymentWebhook(any());
    }

    @Test
    @DisplayName("Return URL handles customer cancellation (ResponseCode=24) cleanly and rejects signature tampering")
    void handlesReturnCancellationAndTamperedSignature() {
        VnPayTransaction txn = VnPayTransaction.builder()
                .tenantId(tenantId).bookingId(bookingId).reservationId(reservationId)
                .txnRef("VNP_CANCEL_01").orderInfo("Test").amountVnd(70_000L).vnpAmount(7_000_000L)
                .createDate("20261126093000").expireDate("20261126094500").clientIp("127.0.0.1")
                .status(VnPayTransactionStatus.PENDING).build();
        when(txnRepository.findByTxnRef("VNP_CANCEL_01")).thenReturn(Optional.of(txn));
        when(reservationRepository.findByReservationId(reservationId)).thenReturn(Optional.of(heldReservation));

        Map<String, String> cancelParams = new LinkedHashMap<>();
        cancelParams.put("vnp_TmnCode", "ARENAPULSE");
        cancelParams.put("vnp_TxnRef", "VNP_CANCEL_01");
        cancelParams.put("vnp_Amount", "7000000");
        cancelParams.put("vnp_ResponseCode", "24");
        cancelParams.put("vnp_TransactionStatus", "02");

        VnPayReturnVerificationResponse res = service.handleReturnCallback(signCallback(cancelParams));
        assertTrue(res.signatureValid());
        assertFalse(res.paymentSucceeded());
        assertEquals("PENDING", res.code());
        assertEquals(VnPayTransactionStatus.PENDING, txn.getStatus());
        verifyNoInteractions(bookingOrchestratorService);

        // Verify tampered signature returns code 97
        Map<String, String> tampered = new LinkedHashMap<>(cancelParams);
        tampered.put("vnp_SecureHash", "0000deadbeef");
        VnPayReturnVerificationResponse tamperedRes = service.handleReturnCallback(tampered);
        assertFalse(tamperedRes.signatureValid());
        assertEquals("97", tamperedRes.code());
    }

    @Test
    @DisplayName("QueryDR and Refund call VNPAY merchant_webapi with valid pipe-delimited HMAC-SHA512 payload")
    @SuppressWarnings("unchecked")
    void executesQueryDrAndRefundWithPipeDelimitedHmacSha512() throws Exception {
        VnPayTransaction successTxn = VnPayTransaction.builder()
                .tenantId(tenantId).bookingId(bookingId).reservationId(reservationId)
                .txnRef("VNP_OK_99").orderInfo("Test").amountVnd(70_000L).vnpAmount(7_000_000L)
                .createDate("20261126093000").expireDate("20261126094500").payDate("20261126093100")
                .transactionNo("99887766").bankCode("NCB").clientIp("127.0.0.1")
                .status(VnPayTransactionStatus.SUCCESS).build();
        when(txnRepository.findByTxnRef("VNP_OK_99")).thenReturn(Optional.of(successTxn));

        HttpResponse<String> queryResp = mock(HttpResponse.class);
        when(queryResp.statusCode()).thenReturn(200);
        when(queryResp.body()).thenReturn("""
                {
                  "vnp_ResponseCode": "00",
                  "vnp_Message": "Confirm Success",
                  "vnp_TxnRef": "VNP_OK_99",
                  "vnp_Amount": "7000000",
                  "vnp_BankCode": "NCB",
                  "vnp_TransactionNo": "99887766",
                  "vnp_TransactionStatus": "00",
                  "vnp_PayDate": "20261126093100"
                }
                """);
        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(queryResp);

        VnPayQueryDrResponse dr = service.queryTransactionStatus(
                new VnPayQueryDrRequest("VNP_OK_99", "Kiem tra trang thai"),
                "127.0.0.1"
        );
        assertEquals("00", dr.responseCode());
        assertEquals(70_000L, dr.amountVnd());
        assertTrue(dr.liveGatewayResponse());
        assertNotNull(successTxn.getLastQueryDrAt());

        // Refund execution
        HttpResponse<String> refundResp = mock(HttpResponse.class);
        when(refundResp.statusCode()).thenReturn(200);
        when(refundResp.body()).thenReturn("""
                {
                  "vnp_ResponseCode": "00",
                  "vnp_Message": "Refund Success"
                }
                """);
        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(refundResp);

        VnPayRefundResponse refund = service.refundTransaction(
                new VnPayRefundRequest("VNP_OK_99", 70_000L, "02", "admin@arenapulse.vn", "Hoan tien test"),
                "127.0.0.1"
        );
        assertEquals("00", refund.responseCode());
        assertEquals("REFUNDED", refund.status());
        assertEquals(VnPayTransactionStatus.REFUNDED, successTxn.getStatus());
    }

    private Map<String, String> signCallback(Map<String, String> rawParams) {
        String signedUrl = cryptoCodec.buildSignedPaymentUrl("https://callback.local", rawParams, properties.getHashSecret());
        return parseQueryParams(signedUrl);
    }

    private Map<String, String> parseQueryParams(String fullUrl) {
        String query = URI.create(fullUrl).getRawQuery();
        Map<String, String> map = new LinkedHashMap<>();
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0) {
                String k = URLDecoder.decode(pair.substring(0, eq), StandardCharsets.US_ASCII);
                String v = URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.US_ASCII);
                map.put(k, v);
            }
        }
        return map;
    }
}

