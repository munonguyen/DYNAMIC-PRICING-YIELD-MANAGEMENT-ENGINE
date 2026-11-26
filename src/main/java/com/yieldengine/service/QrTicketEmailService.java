package com.yieldengine.service;

import com.yieldengine.record.ops.EmailDispatchResult;
import com.yieldengine.record.ops.TicketPassSnapshot;
import com.yieldengine.entity.Reservation;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.repository.ReservationRepository;
import com.yieldengine.utils.QrCodeImageUtils;
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

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Orchestrates e-ticket email dispatch over SMTP. Sends numeric PIN emails (without QR)
 * for no-scanner PIN_COUNTER venues and signed QR PNG passes for QR_STAFF venues.
 */
@Slf4j
@Service
public class QrTicketEmailService {

    private final JavaMailSender mailSender;
    private final ReservationRepository reservationRepository;
    private final TicketPassService ticketPassService;
    private final TicketEmailTemplateRenderer templateRenderer;
    private final String senderEmail;
    private final boolean mailPasswordConfigured;

    @Autowired
    public QrTicketEmailService(
            @Autowired(required = false) JavaMailSender mailSender,
            ReservationRepository reservationRepository,
            TicketPassService ticketPassService,
            TicketEmailTemplateRenderer templateRenderer,
            @Value("${spring.mail.username:noreply@arenapulse.vn}") String senderEmail,
            @Value("${spring.mail.password:}") String mailPassword,
            @Value("${spring.mail.smtp.allow-anonymous:false}") boolean allowAnonymousSmtp
    ) {
        this.mailSender = mailSender;
        this.reservationRepository = reservationRepository;
        this.ticketPassService = ticketPassService;
        this.templateRenderer = templateRenderer;
        this.senderEmail = StringUtils.hasText(senderEmail) ? senderEmail.trim() : "noreply@arenapulse.vn";
        this.mailPasswordConfigured = allowAnonymousSmtp
                || (StringUtils.hasText(senderEmail) && StringUtils.hasText(mailPassword));
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
            throw new IllegalStateException("Chỉ gửi phiếu nhận sân cho đơn đã thanh toán CONFIRMED.");
        }

        TicketPassSnapshot pass = ticketPassService.buildPassSnapshot(reservation);
        String recipientEmail = StringUtils.hasText(explicitRecipientEmail)
                ? explicitRecipientEmail.trim()
                : pass.customerEmail();
        if (!StringUtils.hasText(recipientEmail)) {
            throw new IllegalArgumentException("Không có địa chỉ email người nhận để gửi phiếu nhận sân.");
        }

        String recipientName = StringUtils.hasText(explicitRecipientName)
                ? explicitRecipientName.trim()
                : pass.customerName();

        boolean pinOnly = templateRenderer.isPinOnlyMode(pass);
        byte[] qrPngBytes = pinOnly ? new byte[0] : QrCodeImageUtils.renderQrPng(pass.qrToken(), 320);
        String html = templateRenderer.renderBookingTicketHtml(pass, recipientName);

        if (mailSender == null || !mailPasswordConfigured) {
            String offlineNote = pinOnly
                    ? "Đã dựng sẵn phiếu Mã PIN 6 số gửi khách (cơ sở không dùng máy quét)."
                    : "Đã dựng sẵn vé QR điện tử (" + qrPngBytes.length + " bytes).";
            return new EmailDispatchResult(false, recipientEmail, reservationId, qrPngBytes.length, offlineNote);
        }

        dispatchMimeEmail(recipientEmail, pass.unitNumber(), pass.venueName(), html, qrPngBytes, pinOnly);
        String successNote = pinOnly
                ? "Đã gửi thành công Mã PIN 6 số nhận sân tới " + recipientEmail
                : "Đã gửi thành công vé điện tử kèm ảnh QR tới " + recipientEmail;
        return new EmailDispatchResult(true, recipientEmail, reservationId, qrPngBytes.length, successNote);
    }

    private void dispatchMimeEmail(
            String recipientEmail,
            String unitNumber,
            String venueName,
            String html,
            byte[] qrPngBytes,
            boolean pinOnly
    ) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, !pinOnly, StandardCharsets.UTF_8.name());
            helper.setFrom(senderEmail);
            helper.setTo(recipientEmail);
            helper.setSubject(pinOnly
                    ? "[ArenaPulse] Mã số nhận sân " + unitNumber + " • " + venueName
                    : "[ArenaPulse] Vé QR Sân " + unitNumber + " • " + venueName);
            helper.setText(html, true);

            if (!pinOnly && qrPngBytes.length > 0) {
                helper.addInline("arenapulseTicketQr", new ByteArrayResource(qrPngBytes), "image/png");
                helper.addAttachment("ArenaPulse-Ve-San-" + unitNumber + ".png",
                        new ByteArrayResource(qrPngBytes), "image/png");
            }

            mailSender.send(mimeMessage);
            log.info("Dispatched {} email to {} for unit {}",
                    pinOnly ? "PIN pass" : "QR ticket", recipientEmail, unitNumber);
        } catch (Exception ex) {
            log.error("Failed dispatching ticket email to {}: {}", recipientEmail, ex.getMessage(), ex);
            throw new IllegalStateException("Gửi email phiếu nhận sân thất bại: " + ex.getMessage(), ex);
        }
    }
}
