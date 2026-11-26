package com.yieldengine.record.marketplace;

import java.time.Instant;
public record OtpVerifyResponse(
        boolean verified,
        String verificationToken,
        Instant verifiedAt
) {
}
