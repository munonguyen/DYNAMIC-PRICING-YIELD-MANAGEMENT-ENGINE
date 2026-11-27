package com.yieldengine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.exception.AppException;
import com.yieldengine.config.VnPayProperties;
import com.yieldengine.record.ops.PaymentWebhookRequest;
import com.yieldengine.record.vnpay.*;
import com.yieldengine.entity.Payment;
import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.VnPayTransaction;
import com.yieldengine.enums.VnPayIpnAckCode;
import com.yieldengine.enums.VnPayResponseCode;
import com.yieldengine.enums.VnPayTransactionStatus;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.exception.ForbiddenAccessException;
import com.yieldengine.mapper.VnPayTransactionMapper;
import com.yieldengine.repository.PaymentRepository;
import com.yieldengine.repository.ReservationRepository;
import com.yieldengine.repository.VnPayTransactionRepository;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.service.vnpay.VnPayCryptoCodec;
import com.yieldengine.validate.VnPayPaymentValidator;
import com.yieldengine.utils.CryptoHashUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Handles the complete VNPAY Payment Gateway v2.1.0 lifecycle:
 * signed checkout URL generation, browser Return verification, idempotent IPN webhook settlement,
 * QueryDR transaction inquiry, and Refund API execution.
 */
@Slf4j
@Service
public class VnPayPaymentService {

    private static final String PROVIDER_CODE = "VNPAY_ESCROW";
    private static final Set<String> REFUND_REJECTED_CODES = Set.of("02", "03", "91", "95", "97");
    private static final List<String> MERCHANT_RESPONSE_FIELDS = List.of(
            "vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message", "vnp_TmnCode", "vnp_TxnRef",
            "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo", "vnp_TransactionType",
            "vnp_TransactionStatus", "vnp_OrderInfo");

    private final VnPayProperties properties;
    private final VnPayCryptoCodec cryptoCodec;
    private final VnPayPaymentValidator validator;
    private final VnPayTransactionMapper mapper;
    private final VnPayTransactionRepository txnRepository;
    private final ReservationRepository reservationRepository;
    private final PaymentRepository paymentRepository;
    private final BookingOrchestratorService bookingOrchestratorService;
    private final VnPayRefundSettlement refundSettlement;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Autowired
    public VnPayPaymentService(
            VnPayProperties properties,
            VnPayCryptoCodec cryptoCodec,
            VnPayPaymentValidator validator,
            VnPayTransactionMapper mapper,
            VnPayTransactionRepository txnRepository,
            ReservationRepository reservationRepository,
            PaymentRepository paymentRepository,
            BookingOrchestratorService bookingOrchestratorService,
            ObjectMapper objectMapper,
            VnPayRefundSettlement refundSettlement
    ) {
        this(
                properties,
                cryptoCodec,
                validator,
                mapper,
                txnRepository,
                reservationRepository,
                paymentRepository,
                bookingOrchestratorService,
                objectMapper,
                refundSettlement,
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
        );
    }

    VnPayPaymentService(
            VnPayProperties properties,
            VnPayCryptoCodec cryptoCodec,
            VnPayPaymentValidator validator,
            VnPayTransactionMapper mapper,
            VnPayTransactionRepository txnRepository,
            ReservationRepository reservationRepository,
            PaymentRepository paymentRepository,
            BookingOrchestratorService bookingOrchestratorService,
            ObjectMapper objectMapper,
            VnPayRefundSettlement refundSettlement,
            HttpClient httpClient
    ) {
        this.properties = properties;
        this.cryptoCodec = cryptoCodec;
        this.validator = validator;
        this.mapper = mapper;
        this.txnRepository = txnRepository;
        this.reservationRepository = reservationRepository;
        this.paymentRepository = paymentRepository;
        this.bookingOrchestratorService = bookingOrchestratorService;
        this.refundSettlement = refundSettlement;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.httpClient = httpClient;
    }

    public boolean isConfigured() {
        return hasText(properties.getTmnCode()) && hasText(properties.getHashSecret())
                && !"VNPAY_SANDBOX_HASH_SECRET_KEY_CONFIGURE_IN_ENV".equals(properties.getHashSecret())
                && hasText(properties.getPayUrl());
    }

    @Transactional
    public VnPayPaymentUrlResponse createPaymentUrl(CreateVnPayPaymentRequest request, String clientIp, UUID userId) {
        if (!isConfigured()) {
            throw new AppException("Cổng VNPay chưa được cấu hình.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        Reservation refreshed = bookingOrchestratorService.prepareGatewayPayment(request.reservationId(), userId);
        long amountVnd = validator.validateAndResolveAmount(request, refreshed);
        syncCustomerContactIfProvided(request);
        UUID bookingId = refreshed.getBookingId();

        Instant now = Instant.now();
        String createDate = cryptoCodec.formatTimestamp(now);
        Instant expiresAt = now.plus(Duration.ofMinutes(properties.getExpireMinutes()));
        if (refreshed.getHoldExpiresAt().isBefore(expiresAt)) {
            expiresAt = refreshed.getHoldExpiresAt();
        }
        if (refreshed.getSlotStart().isBefore(expiresAt)) {
            expiresAt = refreshed.getSlotStart();
        }
        String expireDate = cryptoCodec.formatTimestamp(expiresAt);
        String txnRef = generateTxnRef(request.reservationId(), now);
        String locale = (request.locale() != null && !request.locale().isBlank())
                ? request.locale()
                : properties.getDefaultLocale();
        String orderType = (request.orderType() != null && !request.orderType().isBlank())
                ? request.orderType()
                : properties.getDefaultOrderType();
        String orderInfo = cryptoCodec.sanitizeOrderInfo(
                request.orderInfo(),
                "Thanh toan dat san ArenaPulse " + txnRef
        );
        String resolvedIp = (clientIp != null && !clientIp.isBlank()) ? clientIp : "127.0.0.1";
        long vnpAmount = amountVnd * 100L;

        Map<String, String> vnpParams = buildPayParams(
                txnRef,
                vnpAmount,
                orderInfo,
                orderType,
                locale,
                resolvedIp,
                createDate,
                expireDate,
                request.bankCode()
        );
        String paymentUrl = cryptoCodec.buildSignedPaymentUrl(
                properties.getPayUrl(),
                vnpParams,
                properties.getHashSecret()
        );

        VnPayTransaction saved = txnRepository.save(VnPayTransaction.builder()
                .tenantId(refreshed.getTenantId())
                .bookingId(bookingId)
                .reservationId(refreshed.getReservationId())
                .txnRef(txnRef)
                .orderInfo(orderInfo)
                .orderType(orderType)
                .amountVnd(amountVnd)
                .vnpAmount(vnpAmount)
                .currency(properties.getCurrCode())
                .locale(locale)
                .bankCode(hasText(request.bankCode()) ? request.bankCode().trim() : null)
                .createDate(createDate)
                .expireDate(expireDate)
                .clientIp(resolvedIp)
                .status(VnPayTransactionStatus.PENDING)
                .secureHashValid(false)
                .build());

        log.info("Created VNPAY payment URL txnRef={} reservationId={} amountVnd={}",
                saved.getTxnRef(), saved.getReservationId(), saved.getAmountVnd());

        return new VnPayPaymentUrlResponse(
                "ok",
                "success",
                paymentUrl,
                saved.getTxnRef(),
                saved.getReservationId(),
                saved.getAmountVnd(),
                saved.getVnpAmount(),
                saved.getCreateDate(),
                saved.getExpireDate(),
                saved.getStatus().name()
        );
    }

    @Transactional(readOnly = true)
    public VnPayReturnVerificationResponse handleReturnCallback(Map<String, String> params) {
        if (!signatureAndMerchantMatch(params)) {
            return mapper.toReturnResponse("97", VnPayResponseCode.describe("97"), false, false, null, null);
        }
        String txnRef = params.get("vnp_TxnRef");
        var transaction = !hasText(txnRef) ? null : txnRepository.findByTxnRef(txnRef).orElse(null);
        if (transaction == null) {
            return mapper.toReturnResponse("01", "Không tìm thấy giao dịch VNPay.", true, false, null, null);
        }
        if (parseLongSafe(params.get("vnp_Amount"), -1L) != transaction.getVnpAmount()) {
            return mapper.toReturnResponse("04", "Số tiền VNPay không khớp đơn đặt.", true, false, null, null);
        }
        var reservation = loadReservationQuietly(transaction.getReservationId());
        boolean succeeded = transaction.getStatus() == VnPayTransactionStatus.SUCCESS && transaction.getPayment() != null
                && "SUCCESS".equals(transaction.getPayment().getStatus())
                && transaction.getPayment().getGatewayVerifiedAt() != null;
        String code = transaction.getResponseCode();
        String message = code == null ? "Đang chờ xác nhận từ VNPay." : VnPayResponseCode.describe(code);
        return mapper.toReturnResponse(code == null ? "PENDING" : code, message, true, succeeded,
                transaction, reservation == null ? null : reservation.getStatus());
    }

    @Transactional
    public VnPayIpnResponse handleIpnCallback(Map<String, String> params) {
        if (!signatureAndMerchantMatch(params)) {
            return ack(VnPayIpnAckCode.INVALID_CHECKSUM);
        }
        String txnRef = params.get("vnp_TxnRef");
        var transaction = !hasText(txnRef) ? null : txnRepository.lockByTxnRef(txnRef).orElse(null);
        if (transaction == null) {
            return ack(VnPayIpnAckCode.ORDER_NOT_FOUND);
        }
        if (parseLongSafe(params.get("vnp_Amount"), -1L) != transaction.getVnpAmount()) {
            return ack(VnPayIpnAckCode.INVALID_AMOUNT);
        }
        boolean succeeded = VnPayResponseCode.isSuccess(params.get("vnp_ResponseCode"), params.get("vnp_TransactionStatus"));
        if (succeeded && parseLongSafe(params.get("vnp_TransactionNo"), 0) <= 0) {
            return ack(VnPayIpnAckCode.UNKNOWN_ERROR);
        }
        if (transaction.getStatus().isFinalized()) {
            // Older successful rows may have been created by a browser return. Accept later IPN evidence
            // only for that exact provider transaction.
            if (succeeded && transaction.getStatus() == VnPayTransactionStatus.SUCCESS
                    && transaction.getPayment() != null && transaction.getPayment().getGatewayVerifiedAt() == null
                    && java.util.Objects.equals(transaction.getTransactionNo(), params.get("vnp_TransactionNo"))) {
                transaction.getPayment().setGatewayVerifiedAt(Instant.now());
            }
            return ack(VnPayIpnAckCode.ALREADY_CONFIRMED);
        }
        if (!hasText(params.get("vnp_ResponseCode")) || !hasText(params.get("vnp_TransactionStatus"))) {
            return ack(VnPayIpnAckCode.UNKNOWN_ERROR);
        }
        if (!"01".equals(params.get("vnp_TransactionStatus"))) {
            applyGatewayOutcome(transaction, params);
        }
        return ack(VnPayIpnAckCode.SUCCESS);
    }

    private boolean signatureAndMerchantMatch(Map<String, String> params) {
        return isConfigured() && params != null && properties.getTmnCode().equals(params.get("vnp_TmnCode"))
                && cryptoCodec.verifyCallbackSignature(params, properties.getHashSecret());
    }

    @Transactional
    public VnPayQueryDrResponse queryTransactionStatus(VnPayQueryDrRequest request, String clientIp) {
        requireMerchantApi();
        VnPayTransaction txn = findByTxnRefOrThrow(request.txnRef());
        String requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String command = "querydr";
        String createDate = cryptoCodec.formatTimestamp(Instant.now());
        String resolvedIp = hasText(clientIp) ? clientIp : "127.0.0.1";
        String orderInfo = cryptoCodec.sanitizeOrderInfo(
                request.orderInfo(),
                "Truy van giao dich VNPAY " + txn.getTxnRef()
        );

        String secureHash = cryptoCodec.signPipeSeparated(
                properties.getHashSecret(),
                requestId,
                properties.getVersion(),
                command,
                properties.getTmnCode(),
                txn.getTxnRef(),
                txn.getCreateDate(),
                createDate,
                resolvedIp,
                orderInfo
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("vnp_RequestId", requestId);
        body.put("vnp_Version", properties.getVersion());
        body.put("vnp_Command", command);
        body.put("vnp_TmnCode", properties.getTmnCode());
        body.put("vnp_TxnRef", txn.getTxnRef());
        body.put("vnp_OrderInfo", orderInfo);
        body.put("vnp_TransactionDate", txn.getCreateDate());
        body.put("vnp_CreateDate", createDate);
        body.put("vnp_IpAddr", resolvedIp);
        body.put("vnp_SecureHash", secureHash);

        JsonNode root = executeMerchantApiPost(body, txn.getTxnRef(), command);
        if (!matchesMerchantResponse(root, txn.getTxnRef(), command)
                || ("00".equals(field(root, "vnp_ResponseCode"))
                && parseLongSafe(field(root, "vnp_Amount"), -1L) != txn.getVnpAmount())) {
            throw new IllegalStateException("Phản hồi tra cứu VNPay không khớp chữ ký hoặc giao dịch.");
        }
        txn.setLastQueryDrAt(Instant.now());
        txn.setLastQueryDrPayload(objectMapper.convertValue(
                root,
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}
        ));
        txnRepository.save(txn);

        return new VnPayQueryDrResponse(
                txn.getTxnRef(),
                root.path("vnp_ResponseCode").asText("99"),
                root.path("vnp_Message").asText("Không rõ phản hồi QueryDR từ VNPAY"),
                root.path("vnp_TransactionNo").asText(txn.getTransactionNo()),
                root.path("vnp_TransactionStatus").asText(txn.getTransactionStatus()),
                parseLongSafe(root.path("vnp_Amount").asText("0"), 0L) / 100L,
                root.path("vnp_BankCode").asText(txn.getBankCode()),
                root.path("vnp_PayDate").asText(txn.getPayDate()),
                true
        );
    }

    public VnPayRefundResponse refundTransaction(VnPayRefundRequest request, String clientIp) {
        requireMerchantApi();
        String requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        VnPayTransaction txn = refundSettlement.begin(request, requestId);
        String command = "refund";
        long refundVnpAmount = request.amountVnd() * 100L;
        String transactionNo = hasText(txn.getTransactionNo()) ? txn.getTransactionNo() : "0";
        String transactionDate = hasText(txn.getPayDate()) ? txn.getPayDate() : txn.getCreateDate();
        String createDate = cryptoCodec.formatTimestamp(Instant.now());
        String resolvedIp = hasText(clientIp) ? clientIp : "127.0.0.1";
        String orderInfo = cryptoCodec.sanitizeOrderInfo(
                request.orderInfo(),
                "Hoan tien giao dich VNPAY " + txn.getTxnRef()
        );

        String secureHash = cryptoCodec.signPipeSeparated(
                properties.getHashSecret(),
                requestId,
                properties.getVersion(),
                command,
                properties.getTmnCode(),
                request.transactionType(),
                txn.getTxnRef(),
                String.valueOf(refundVnpAmount),
                transactionNo,
                transactionDate,
                request.createdBy(),
                createDate,
                resolvedIp,
                orderInfo
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("vnp_RequestId", requestId);
        body.put("vnp_Version", properties.getVersion());
        body.put("vnp_Command", command);
        body.put("vnp_TmnCode", properties.getTmnCode());
        body.put("vnp_TransactionType", request.transactionType());
        body.put("vnp_TxnRef", txn.getTxnRef());
        body.put("vnp_Amount", refundVnpAmount);
        body.put("vnp_TransactionNo", transactionNo);
        body.put("vnp_TransactionDate", transactionDate);
        body.put("vnp_CreateBy", request.createdBy());
        body.put("vnp_CreateDate", createDate);
        body.put("vnp_IpAddr", resolvedIp);
        body.put("vnp_OrderInfo", orderInfo);
        body.put("vnp_SecureHash", secureHash);

        JsonNode root;
        try {
            root = executeMerchantApiPost(body, txn.getTxnRef(), command);
        } catch (IllegalStateException ex) {
            log.warn("Uncertain VNPay refund result for txnRef={}", txn.getTxnRef());
            return uncertainRefund(request);
        }
        if (!matchesMerchantResponse(root, txn.getTxnRef(), command)
                || parseLongSafe(field(root, "vnp_Amount"), -1L) != refundVnpAmount
                || !request.transactionType().equals(field(root, "vnp_TransactionType"))) {
            return uncertainRefund(request);
        }

        String code = field(root, "vnp_ResponseCode");
        String gatewayStatus = field(root, "vnp_TransactionStatus");
        String status = VnPayTransactionStatus.REFUND_PENDING.name();
        if ("00".equals(code) && "00".equals(gatewayStatus)
                && parseLongSafe(field(root, "vnp_TransactionNo"), -1L) > 0) {
            refundSettlement.complete(txn.getTxnRef(), field(root, "vnp_TransactionNo"), Instant.now());
            status = VnPayTransactionStatus.REFUNDED.name();
        } else if (REFUND_REJECTED_CODES.contains(code) || "09".equals(gatewayStatus)) {
            refundSettlement.releaseRejected(txn.getTxnRef());
            status = "REFUND_REJECTED";
        }
        return new VnPayRefundResponse(txn.getTxnRef(), code, field(root, "vnp_Message"),
                request.amountVnd(), request.transactionType(), status, true);
    }

    @Transactional(readOnly = true)
    public VnPayTransactionSummaryDto getTransactionByTxnRef(String txnRef, SessionPrincipal actor) {
        VnPayTransaction txn = findByTxnRefOrThrow(txnRef);
        requireTransactionAccess(txn.getReservationId(), actor);
        return mapper.toSummaryDto(txn);
    }

    @Transactional(readOnly = true)
    public List<VnPayTransactionSummaryDto> listTransactionsByReservation(UUID reservationId, SessionPrincipal actor) {
        requireTransactionAccess(reservationId, actor);
        return txnRepository.findByReservationIdOrderByCreatedAtDesc(reservationId).stream()
                .map(mapper::toSummaryDto)
                .toList();
    }

    private void requireTransactionAccess(UUID reservationId, SessionPrincipal actor) {
        Reservation reservation = reservationRepository.findByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt sân."));
        if (!actor.userId().equals(reservation.getUserId())
                && !actor.hasPlatformRole("ADMIN", "ACCOUNTANT")
                && !actor.hasTenantRole(reservation.getTenantId(), "MANAGER", "ACCOUNTANT", "STAFF")) {
            throw new ForbiddenAccessException("Bạn không có quyền xem giao dịch của đơn.");
        }
    }

    private void requireMerchantApi() {
        if (!isConfigured() || !hasText(properties.getApiUrl())) {
            throw new IllegalStateException("API đối soát VNPay chưa được cấu hình.");
        }
    }

    private boolean matchesMerchantResponse(JsonNode root, String txnRef, String command) {
        String responseCommand = field(root, "vnp_Command");
        String responseMerchant = field(root, "vnp_TmnCode");
        if ((!command.equals(responseCommand) && (!"refund".equals(command) || !responseCommand.isEmpty()))
                || (!properties.getTmnCode().equals(responseMerchant) && (!"refund".equals(command) || !responseMerchant.isEmpty()))
                || !txnRef.equals(field(root, "vnp_TxnRef"))
                || !hasText(field(root, "vnp_ResponseId")) || !hasText(field(root, "vnp_ResponseCode"))) {
            return false;
        }
        Stream<String> fields = MERCHANT_RESPONSE_FIELDS.stream();
        if ("querydr".equals(command)) {
            fields = Stream.concat(fields, Stream.of("vnp_PromotionCode", "vnp_PromotionAmount"));
        }
        String expected = cryptoCodec.signPipeSeparated(properties.getHashSecret(), fields.map(key -> field(root, key)).toArray(String[]::new));
        return CryptoHashUtils.constantTimeEqualsIgnoreCase(expected, field(root, "vnp_SecureHash"));
    }

    private String field(JsonNode root, String key) {
        return root == null ? "" : root.path(key).asText("");
    }

    private VnPayRefundResponse uncertainRefund(VnPayRefundRequest request) {
        return new VnPayRefundResponse(request.txnRef(), "99", "Chưa xác minh được hoàn tiền. Cần đối soát với VNPay.",
                request.amountVnd(), request.transactionType(), VnPayTransactionStatus.REFUND_PENDING.name(), false);
    }

    private Reservation applyGatewayOutcome(VnPayTransaction txn, Map<String, String> params) {
        String responseCode = params.get("vnp_ResponseCode");
        String transactionStatus = params.get("vnp_TransactionStatus");
        boolean succeeded = VnPayResponseCode.isSuccess(responseCode, transactionStatus);

        txn.setBankCode(params.get("vnp_BankCode"));
        txn.setCardType(params.get("vnp_CardType"));
        txn.setTransactionNo(params.get("vnp_TransactionNo"));
        txn.setResponseCode(responseCode);
        txn.setTransactionStatus(transactionStatus);
        txn.setPayDate(params.get("vnp_PayDate"));
        txn.setSecureHashValid(true);
        txn.setRawCallbackPayload(new LinkedHashMap<>(params));

        VnPayTransactionStatus nextStatus;
        if (succeeded) {
            nextStatus = VnPayTransactionStatus.SUCCESS;
        } else if (VnPayResponseCode.CODE_USER_CANCELLED.equals(responseCode)) {
            nextStatus = VnPayTransactionStatus.CANCELLED;
        } else {
            nextStatus = VnPayTransactionStatus.FAILED;
        }
        txn.setStatus(nextStatus);

        String webhookStatus = succeeded ? "SUCCESS" : "FAILED";
        Reservation updated = bookingOrchestratorService.processPaymentWebhook(new PaymentWebhookRequest(
                PROVIDER_CODE,
                txn.getTxnRef(),
                txn.getReservationId(),
                null,
                txn.getAmountVnd(),
                webhookStatus
        ));

        syncLinkedPayment(txn, params);
        txnRepository.save(txn);

        log.info("Processed VNPAY callback txnRef={} status={} responseCode={} reservationStatus={}",
                txn.getTxnRef(), txn.getStatus(), responseCode, updated.getStatus());
        return updated;
    }

    private void syncLinkedPayment(VnPayTransaction txn, Map<String, String> params) {
        paymentRepository.findByProviderAndProviderRef(PROVIDER_CODE, txn.getTxnRef())
                .ifPresent(payment -> {
                    payment.setRawPayload(new LinkedHashMap<>(params));
                    paymentRepository.save(payment);
                    txn.setPayment(payment);
                });
    }

    private void syncCustomerContactIfProvided(CreateVnPayPaymentRequest request) {
        boolean hasContact = hasText(request.customerName())
                || hasText(request.customerPhone())
                || hasText(request.customerEmail())
                || Boolean.TRUE.equals(request.needVatInvoice())
                || hasText(request.bookingNote());
        if (!hasContact) {
            return;
        }
        bookingOrchestratorService.updateBookingContactDetails(
                request.reservationId(),
                request.customerName(),
                request.customerPhone(),
                request.customerEmail(),
                request.needVatInvoice(),
                request.vatCompanyName(),
                request.vatTaxCode(),
                request.bookingNote()
        );
    }

    private Map<String, String> buildPayParams(
            String txnRef,
            long vnpAmount,
            String orderInfo,
            String orderType,
            String locale,
            String clientIp,
            String createDate,
            String expireDate,
            String bankCode
    ) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("vnp_Version", properties.getVersion());
        params.put("vnp_Command", properties.getCommandPay());
        params.put("vnp_TmnCode", properties.getTmnCode());
        params.put("vnp_Amount", String.valueOf(vnpAmount));
        params.put("vnp_CurrCode", properties.getCurrCode());
        if (hasText(bankCode)) {
            params.put("vnp_BankCode", bankCode.trim());
        }
        params.put("vnp_TxnRef", txnRef);
        params.put("vnp_OrderInfo", orderInfo);
        params.put("vnp_OrderType", orderType);
        params.put("vnp_Locale", locale);
        params.put("vnp_ReturnUrl", properties.getReturnUrl());
        params.put("vnp_IpAddr", clientIp);
        params.put("vnp_CreateDate", createDate);
        params.put("vnp_ExpireDate", expireDate);
        return params;
    }

    private JsonNode executeMerchantApiPost(Map<String, Object> payload, String txnRef, String command) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(properties.getApiUrl()))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    httpRequest,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException(
                        "VNPAY " + command + " HTTP " + response.statusCode() + " cho txnRef=" + txnRef
                );
            }
            return objectMapper.readTree(response.body());
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể kết nối VNPAY API (" + command + "): " + ex.getMessage(), ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Yêu cầu VNPAY " + command + " bị gián đoạn.", ex);
        }
    }

    private VnPayTransaction findByTxnRefOrThrow(String txnRef) {
        return txnRepository.findByTxnRef(txnRef)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy giao dịch VNPAY txnRef=" + txnRef));
    }

    private Reservation loadReservationQuietly(UUID reservationId) {
        return reservationRepository.findByReservationId(reservationId).orElse(null);
    }

    private VnPayIpnResponse ack(VnPayIpnAckCode ackCode) {
        return new VnPayIpnResponse(ackCode.getCode(), ackCode.getMessage());
    }

    private String generateTxnRef(UUID reservationId, Instant now) {
        String shortId = reservationId.toString().replace("-", "").substring(0, 8).toUpperCase();
        String randomSuffix = UUID.randomUUID().toString().replace("-", "").substring(0, 4).toUpperCase();
        return "VNP_" + shortId + "_" + (now.toEpochMilli() % 100000000L) + "_" + randomSuffix;
    }

    private long parseLongSafe(String raw, long fallback) {
        if (!hasText(raw)) {
            return fallback;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
