package com.yieldengine.service;

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
 * Orchestrates e-ticket email dispatch (PNG QR attachment + 6-digit PIN pass) over SMTP.
 * All pass data assembly and HTML rendering are delegated cleanly to TicketPassService & TicketEmailTemplateRenderer.
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

        TicketPassService.TicketPassSnapshot pass = ticketPassService.buildPassSnapshot(reservation);
        String recipientEmail = StringUtils.hasText(explicitRecipientEmail)
                ? explicitRecipientEmail.trim()
                : pass.customerEmail();
        if (!StringUtils.hasText(recipientEmail)) {
            throw new IllegalArgumentException("Không có địa chỉ email người nhận để gửi mã QR.");
        }

        String recipientName = StringUtils.hasText(explicitRecipientName)
                ? explicitRecipientName.trim()
                : pass.customerName();

        byte[] qrPngBytes = QrCodeImageUtils.renderQrPng(pass.qrToken(), 320);
        String html = templateRenderer.renderBookingTicketHtml(pass, recipientName);

        if (mailSender == null || !mailPasswordConfigured) {
            log.warn("SMTP credentials missing — prepared QR PNG ({} bytes) for {} without network send.",
                    qrPngBytes.length, recipientEmail);
            return new EmailDispatchResult(
                    false,
                    recipientEmail,
                    reservationId,
                    qrPngBytes.length,
                    "SMTP chưa cấu hình MAIL_USERNAME/MAIL_PASSWORD (Gmail App Password) — đã dựng sẵn vé PNG QR ("
                            + qrPngBytes.length + " bytes)."
            );
        }

        dispatchMimeEmail(recipientEmail, pass.unitNumber(), pass.venueName(), html, qrPngBytes);
        return new EmailDispatchResult(
                true,
                recipientEmail,
                reservationId,
                qrPngBytes.length,
                "Đã gửi thành công vé điện tử kèm ảnh QR tới " + recipientEmail
        );
    }

    private void dispatchMimeEmail(
            String recipientEmail,
            String unitNumber,
            String venueName,
            String html,
            byte[] qrPngBytes
    ) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, StandardCharsets.UTF_8.name());
            helper.setFrom(senderEmail);
            helper.setTo(recipientEmail);
            helper.setSubject("[ArenaPulse] Vé Điện Tử Sân " + unitNumber + " • " + venueName);
            helper.setText(html, true);
            helper.addInline("arenapulseTicketQr", new ByteArrayResource(qrPngBytes), "image/png");
            helper.addAttachment("ArenaPulse-Ve-San-" + unitNumber + ".png",
                    new ByteArrayResource(qrPngBytes), "image/png");

            mailSender.send(mimeMessage);
            log.info("Dispatched ticket email ({} bytes PNG) to {} for unit {}",
                    qrPngBytes.length, recipientEmail, unitNumber);
        } catch (Exception ex) {
            log.error("Failed dispatching ticket email to {}: {}", recipientEmail, ex.getMessage(), ex);
            throw new IllegalStateException("Gửi email vé điện tử thất bại: " + ex.getMessage(), ex);
        }
    }
}
