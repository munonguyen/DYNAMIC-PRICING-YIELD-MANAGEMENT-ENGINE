package com.yieldengine.service;

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
 * Loads the externalized HTML ticket email template and renders escaped domain placeholders.
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

    public String renderBookingTicketHtml(
            TicketPassService.TicketPassSnapshot pass,
            String recipientName
    ) {
        boolean isPinCounter = "PIN_COUNTER".equalsIgnoreCase(pass.checkinMode())
                || "MANUAL".equalsIgnoreCase(pass.checkinMode());
        String pinHeadline = isPinCounter
                ? "Cơ sở dùng xác thực PIN 6 số (Không cần máy quét)"
                : "Mã PIN 6 số dự phòng đọc tại quầy (dùng 1 lần)";

        Map<String, String> values = Map.ofEntries(
                Map.entry("customerName", escape(recipientName)),
                Map.entry("venueName", escape(pass.venueName())),
                Map.entry("venueAddress", escape(pass.venueAddress())),
                Map.entry("groupName", escape(pass.groupName())),
                Map.entry("unitNumber", escape(pass.unitNumber())),
                Map.entry("slotLabel", escape(DATE_FMT.format(pass.slotStart()))),
                Map.entry("lockedPrice", formatVnd(pass.lockedPrice())),
                Map.entry("paidAmount", formatVnd(pass.paidAmount())),
                Map.entry("remainingAtVenue", formatVnd(pass.remainingAtVenue())),
                Map.entry("pinHeadline", escape(pinHeadline)),
                Map.entry("checkinPinCode", escape(pass.checkinPinCode())),
                Map.entry("qrJti", escape(String.valueOf(pass.qrJti())))
        );

        String rendered = cachedTemplate;
        for (Map.Entry<String, String> entry : values.entrySet()) {
            rendered = rendered.replace("{{" + entry.getKey() + "}}", entry.getValue());
        }
        return rendered;
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
