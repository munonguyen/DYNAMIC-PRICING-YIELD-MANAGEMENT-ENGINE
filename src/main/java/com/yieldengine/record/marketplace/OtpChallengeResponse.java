package com.yieldengine.record.marketplace;

import java.util.UUID;
public record OtpChallengeResponse(
        UUID challengeId,
        String maskedTarget,
        long expiresInSeconds,
        String sandboxOtpHint
) {
}
