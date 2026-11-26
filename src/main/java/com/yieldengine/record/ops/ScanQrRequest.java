package com.yieldengine.record.ops;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record ScanQrRequest(
        @NotBlank String qrToken,
        @Size(max = 6) String phoneLast4
) {
    public ScanQrRequest(String qrToken) {
        this(qrToken, null);
    }
}
