package com.yieldengine.record.marketplace;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
public record UpdateVenueSettingsRequest(
        String name,
        String address,
        String phone,
        @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitude,
        @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitude,
        @Pattern(regexp = "QR_STAFF|PIN_COUNTER|MANUAL") String checkinMode,
        Boolean isStaffChatEnabled
) {
}
