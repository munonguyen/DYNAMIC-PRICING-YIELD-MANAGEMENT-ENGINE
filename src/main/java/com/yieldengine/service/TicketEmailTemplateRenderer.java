package com.yieldengine.service;

import com.yieldengine.dto.ops.TicketPassSnapshot;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

/**
 * Loads the externalized HTML ticket email template and renders strictly mode-specific
 * verification passes: numeric PIN pass only for no-scanner venues, or QR pass only for scanner venues.
 */
@Component
public class TicketEmailTemplateRenderer {

    private static final String TEMPLATE_PATH = "templates/email/booking-ticket-pass.html";
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy").withZone(VN_ZONE);

    private final String cachedTemplate;

    public TicketEmailTemplateRenderer() {
        this.cachedTemplate = loadTemplate(TEMPLATE_PATH);
    }

    public boolean isPinOnlyMode(TicketPassSnapshot pass) {
        return "PIN_COUNTER".equalsIgnoreCase(pass.checkinMode())
                || "MANUAL".equalsIgnoreCase(pass.checkinMode());
    }

    public String renderBookingTicketHtml(
            TicketPassSnapshot pass,
            String recipientName
    ) {
        boolean pinOnly = isPinOnlyMode(pass);
        String passHeading = pinOnly
                ? "Phiếu Mã Số Nhận Sân Thể Thao"
                : "Vé QR Điện Tử Đặt Sân Thể Thao";
        String checkinModeLabel = pinOnly
                ? "Xác thực bằng Mã PIN 6 chữ số tại quầy"
                : "Quét mã QR 1 lần tại quầy tiếp đón";
        String verificationBlock = pinOnly
                ? buildNumericPinBlock(pass.checkinPinCode())
                : buildQrBlock(String.valueOf(pass.qrJti()));

        Map<String, String> values = Map.ofEntries(
                Map.entry("passHeading", escape(passHeading)),
                Map.entry("customerName", escape(recipientName)),
                Map.entry("venueName", escape(pass.venueName())),
                Map.entry("venueAddress", escape(pass.venueAddress())),
                Map.entry("groupName", escape(pass.groupName())),
                Map.entry("unitNumber", escape(pass.unitNumber())),
                Map.entry("slotLabel", escape(DATE_FMT.format(pass.slotStart()))),
                Map.entry("checkinModeLabel", escape(checkinModeLabel)),
                Map.entry("lockedPrice", formatVnd(pass.lockedPrice())),
                Map.entry("paidAmount", formatVnd(pass.paidAmount())),
                Map.entry("remainingAtVenue", formatVnd(pass.remainingAtVenue())),
                Map.entry("verificationBlock", verificationBlock)
        );

        String rendered = cachedTemplate;
        for (Map.Entry<String, String> entry : values.entrySet()) {
            rendered = rendered.replace("{{" + entry.getKey() + "}}", entry.getValue());
        }
        return rendered;
    }

    private static String buildNumericPinBlock(String checkinPinCode) {
        return """
                <div style="margin:20px 0 0; padding:20px; border-radius:16px; background:#F4F8F4; border:1px solid #16422C33; text-align:center;">
                  <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.9px; color:#16422C;">Mã Số Xác Thực Nhận Sân (Dùng 1 Lần)</div>
                  <div style="margin-top:8px; font-size:32px; font-weight:800; letter-spacing:8px; color:#0F172A; font-family:monospace;">%s</div>
                  <div style="margin-top:8px; font-size:12px; color:#475569;">Đọc mã số này kèm 4 số cuối SĐT cho nhân viên trực sân (cơ sở không dùng máy quét QR).</div>
                </div>
                """.formatted(escape(checkinPinCode));
    }

    private static String buildQrBlock(String qrJti) {
        return """
                <div style="text-align:center; margin:20px 0 0; padding:20px; border:1px dashed #CBD5E1; border-radius:16px;">
                  <img src="cid:arenapulseTicketQr" alt="ArenaPulse QR Check-in" width="210" height="210" style="display:block; margin:0 auto;" />
                  <div style="margin-top:10px; font-size:12px; color:#475569;">Xuất trình mã QR này để nhân viên quét nhanh tại quầy (hiệu lực 1 lần).</div>
                  <div style="margin-top:4px; font-size:11px; color:#94A3B8;">Mã vé: %s</div>
                </div>
                """.formatted(escape(qrJti));
    }

    private static String escape(String raw) {
        return raw == null ? "" : HtmlUtils.htmlEscape(raw);
    }

    private static String formatVnd(long amount) {
        return String.format(Locale.US, "%,d₫", amount);
    }

    private static String loadTemplate(String path) {
        try {
            ClassPathResource resource = new ClassPathResource(path);
            return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to load email template: " + path, ex);
        }
    }
}
