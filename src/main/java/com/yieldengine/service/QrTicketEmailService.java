package com.yieldengine.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.yieldengine.entity.Booking;
import com.yieldengine.entity.Payment;
import com.yieldengine.entity.Reservation;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.repository.BookingRepository;
import com.yieldengine.repository.PaymentRepository;
import com.yieldengine.repository.ReservationRepository;
import com.yieldengine.repository.ResourceGroupRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Renders signed single-use QR tickets as PNG via ZXing and dispatches HTML emails with inline CID
 * images + downloadable PNG attachments via SMTP (e.g. Gmail smtp.gmail.com:587 STARTTLS).
 */
@Slf4j
@Service
public class QrTicketEmailService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy").withZone(VN_ZONE);

    private final JavaMailSender mailSender;
    private final ReservationRepository reservationRepository;
    private final ResourceGroupRepository resourceGroupRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final PriceLockTokenService priceLockTokenService;
    private final PricingEngineService pricingEngineService;
    private final String senderEmail;
    private final boolean mailPasswordConfigured;

    @Autowired
    public QrTicketEmailService(
            @Autowired(required = false) JavaMailSender mailSender,
            ReservationRepository reservationRepository,
            ResourceGroupRepository resourceGroupRepository,
            BookingRepository bookingRepository,
            PaymentRepository paymentRepository,
            PriceLockTokenService priceLockTokenService,
            PricingEngineService pricingEngineService,
            @Value("${spring.mail.username:noreply@arenapulse.vn}") String senderEmail,
            @Value("${spring.mail.password:}") String mailPassword,
            @Value("${spring.mail.smtp.allow-anonymous:false}") boolean allowAnonymousSmtp
    ) {
        this.mailSender = mailSender;
        this.reservationRepository = reservationRepository;
        this.resourceGroupRepository = resourceGroupRepository;
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.priceLockTokenService = priceLockTokenService;
        this.pricingEngineService = pricingEngineService;
        this.senderEmail = StringUtils.hasText(senderEmail) ? senderEmail.trim() : "noreply@arenapulse.vn";
        this.mailPasswordConfigured = allowAnonymousSmtp || (StringUtils.hasText(senderEmail) && StringUtils.hasText(mailPassword));
    }

    public record EmailDispatchResult(
            boolean sentOverSmtp,
            String recipientEmail,
            UUID reservationId,
            int qrPngBytes,
            String detailMessage
    ) {
    }

    @Transactional(readOnly = true)
    public EmailDispatchResult sendQrTicketEmailForReservation(
            UUID reservationId,
            String explicitRecipientEmail,
            String explicitRecipientName
    ) {
        Reservation reservation = reservationRepository.findByReservationId(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationId));

        if (!"CONFIRMED".equals(reservation.getStatus())) {
            throw new IllegalStateException("Chỉ gửi vé QR cho đơn đã thanh toán CONFIRMED.");
        }

        Booking booking = reservation.getBookingId() != null
                ? bookingRepository.findById(reservation.getBookingId()).orElse(null)
                : null;
        String recipientEmail = StringUtils.hasText(explicitRecipientEmail)
                ? explicitRecipientEmail.trim()
                : (booking != null ? booking.getContactEmail() : null);
        if (!StringUtils.hasText(recipientEmail)) {
            throw new IllegalArgumentException("Không có địa chỉ email người nhận để gửi mã QR.");
        }

        String recipientName = StringUtils.hasText(explicitRecipientName)
                ? explicitRecipientName.trim()
                : (booking != null && StringUtils.hasText(booking.getContactName()) ? booking.getContactName() : "Quý khách");

        ResourceGroup group = resourceGroupRepository.findById(reservation.getGroupId()).orElse(null);
        String venueName = group != null && group.getTenant() != null ? group.getTenant().getName() : "ArenaPulse Sports Complex";
        String venueAddress = group != null && group.getTenant() != null ? group.getTenant().getAddress() : "";
        String groupName = group != null ? group.getName() : "Cụm sân thể thao";
        String unitNumber = reservation.getUnit() != null ? reservation.getUnit().getUnitNumber() : "SAN_01";

        int graceMinutes = group != null && group.getNoshowGraceMinutes() != null ? group.getNoshowGraceMinutes() : 15;
        Instant qrExpiresAt = reservation.getSlotStart().plus(Duration.ofMinutes(90 + graceMinutes));
        UUID qrJti = reservation.getQrJti() != null ? reservation.getQrJti() : UUID.randomUUID();
        String qrToken = priceLockTokenService.generateQrToken(
                pricingEngineService.getActiveQrKeyId(),
                qrJti,
                reservation.getTenantId(),
                reservation.getReservationId(),
                reservation.getSlotStart(),
                qrExpiresAt
        );

        long paidAmount = booking != null
                ? paymentRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()).stream()
                        .filter(p -> "SUCCESS".equals(p.getStatus()))
                        .mapToLong(Payment::getAmount)
                        .sum()
                : reservation.getDepositAmount();
        if (paidAmount == 0) {
            paidAmount = reservation.getDepositAmount();
        }
        long remainingAtVenue = Math.max(0L, reservation.getLockedPrice() - paidAmount);
        String effectiveCheckinMode = group != null && group.getCheckinMode() != null
                ? group.getCheckinMode()
                : (group != null && group.getTenant() != null ? group.getTenant().getCheckinMode() : "QR_STAFF");
        String checkinPinCode = priceLockTokenService.deriveCheckInPin(reservation.getReservationId(), qrJti);

        byte[] qrPngBytes = generateQrPngBytes(qrToken, 320);

        String html = buildHtmlTicketEmail(
                recipientName,
                venueName,
                venueAddress,
                groupName,
                unitNumber,
                DATE_FMT.format(reservation.getSlotStart()),
                reservation.getLockedPrice(),
                paidAmount,
                remainingAtVenue,
                qrJti.toString(),
                effectiveCheckinMode,
                checkinPinCode
        );

        if (mailSender == null || !mailPasswordConfigured) {
            log.warn("SMTP credentials (MAIL_USERNAME / MAIL_PASSWORD) not configured — prepared QR PNG ({} bytes) for {} without network send.",
                    qrPngBytes.length, recipientEmail);
            return new EmailDispatchResult(
                    false,
                    recipientEmail,
                    reservationId,
                    qrPngBytes.length,
                    "SMTP chưa cấu hình MAIL_USERNAME/MAIL_PASSWORD (Gmail App Password) — đã dựng sẵn vé PNG QR (" + qrPngBytes.length + " bytes)."
            );
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, StandardCharsets.UTF_8.name());
            helper.setFrom(senderEmail);
            helper.setTo(recipientEmail);
            helper.setSubject("[ArenaPulse] Vé QR Sân " + unitNumber + " • " + venueName);
            helper.setText(html, true);
            helper.addInline("arenapulseTicketQr", new ByteArrayResource(qrPngBytes), "image/png");
            helper.addAttachment("ArenaPulse-Ve-San-" + unitNumber + ".png", new ByteArrayResource(qrPngBytes), "image/png");

            mailSender.send(mimeMessage);
            log.info("Dispatched QR e-ticket email ({} bytes PNG) to {} for reservation {}",
                    qrPngBytes.length, recipientEmail, reservationId);
            return new EmailDispatchResult(
                    true,
                    recipientEmail,
                    reservationId,
                    qrPngBytes.length,
                    "Đã gửi thành công vé điện tử kèm ảnh QR tới " + recipientEmail
            );
        } catch (Exception ex) {
            log.error("Failed dispatching QR ticket email to {}: {}", recipientEmail, ex.getMessage(), ex);
            throw new IllegalStateException("Gửi email QR thất bại: " + ex.getMessage(), ex);
        }
    }

    public static byte[] generateQrPngBytes(String qrContent, int sizePx) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(
                    qrContent,
                    BarcodeFormat.QR_CODE,
                    sizePx,
                    sizePx,
                    Map.of(
                            EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M,
                            EncodeHintType.MARGIN, 2,
                            EncodeHintType.CHARACTER_SET, "UTF-8"
                    )
            );
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Failed rendering QR PNG image", ex);
        }
    }

    private static String buildHtmlTicketEmail(
            String customerName,
            String venueName,
            String venueAddress,
            String groupName,
            String unitNumber,
            String slotLabel,
            long lockedPrice,
            long paidAmount,
            long remainingAtVenue,
            String qrJti,
            String checkinMode,
            String checkinPinCode
    ) {
        boolean isPinCounter = "PIN_COUNTER".equalsIgnoreCase(checkinMode) || "MANUAL".equalsIgnoreCase(checkinMode);
        String pinHeadline = isPinCounter
                ? "Cơ sở dùng xác thực PIN 6 số (Không cần máy quét)"
                : "Mã PIN 6 số dự phòng đọc tại quầy (dùng 1 lần)";
        return """
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#F6F8F6; padding:24px; color:#0F172A;">
                  <div style="max-width:560px; margin:0 auto; background:#FFFFFF; border-radius:20px; border:1px solid #E5E7EB; overflow:hidden;">
                    <div style="background:#16422C; padding:22px 24px; color:#FFFFFF;">
                      <div style="font-size:12px; letter-spacing:1.2px; text-transform:uppercase; color:#E7F7D4; font-weight:700;">ArenaPulse E-Ticket Pass</div>
                      <h1 style="margin:6px 0 0; font-size:20px; font-weight:700;">Vé Điện Tử Đặt Sân Thể Thao</h1>
                    </div>
                    <div style="padding:24px;">
                      <p style="margin:0 0 16px; font-size:14px;">Xin chào <strong>%s</strong>, đơn đặt sân của bạn đã được xác nhận thành công.</p>
                      <div style="background:#F8F9FA; border-radius:14px; padding:16px; font-size:13px; line-height:1.7;">
                        <div><strong>Cơ sở:</strong> %s</div>
                        <div><strong>Địa chỉ:</strong> %s</div>
                        <div><strong>Cụm sân:</strong> %s • <strong>Mã sân:</strong> %s</div>
                        <div><strong>Thời gian nhận sân:</strong> %s</div>
                        <div><strong>Tổng giá ca:</strong> %,d₫</div>
                        <div><strong>Đã thanh toán qua cổng:</strong> <span style="color:#16422C; font-weight:700;">%,d₫</span></div>
                        <div><strong>Còn thanh toán tại sân:</strong> %,d₫</div>
                      </div>
                      <div style="margin:18px 0; padding:16px; border-radius:14px; background:#E7F7D4; border:1px solid #16422C33; text-align:center;">
                        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#16422C;">%s</div>
                        <div style="margin-top:6px; font-size:28px; font-weight:800; letter-spacing:6px; color:#0F172A; font-family:monospace;">%s</div>
                        <div style="margin-top:4px; font-size:11px; color:#475569;">Đọc mã PIN này kèm 4 số cuối SĐT cho nhân viên khi nhận sân (tự khóa sau 1 lần dùng).</div>
                      </div>
                      <div style="text-align:center; margin:18px 0; padding:18px; border:1px dashed #CBD5E1; border-radius:16px;">
                        <img src="cid:arenapulseTicketQr" alt="ArenaPulse QR Check-in" width="200" height="200" style="display:block; margin:0 auto;" />
                        <div style="margin-top:10px; font-size:12px; color:#475569;">Hoặc xuất trình mã QR này để nhân viên quét nhanh tại quầy.</div>
                        <div style="margin-top:4px; font-size:11px; color:#94A3B8;">Mã vé: %s</div>
                      </div>
                      <p style="margin:0; font-size:12px; color:#64748B;">Bạn cũng có thể mở lại vé và mã PIN bất cứ lúc nào trong mục <strong>Vé của tôi</strong> trên hệ thống ArenaPulse.</p>
                    </div>
                  </div>
                </div>
                """.formatted(
                customerName, venueName, venueAddress, groupName, unitNumber,
                slotLabel, lockedPrice, paidAmount, remainingAtVenue,
                pinHeadline, checkinPinCode, qrJti
        );
    }
}

