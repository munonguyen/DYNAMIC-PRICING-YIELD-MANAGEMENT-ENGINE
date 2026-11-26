package com.yieldengine.dto.ops;

import java.util.UUID;

/**
 * Result summary of dispatching an electronic check-in pass over SMTP.
 */
public record EmailDispatchResult(
        boolean sentOverSmtp,
        String recipientEmail,
        UUID reservationId,
        int qrPngBytes,
        String detailMessage
) {
}
