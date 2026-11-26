package com.yieldengine.record.validate;

import java.util.List;
public record InternalRiskAssessment(
        boolean compliant,
        short riskScore,
        String cccdProvinceName,
        List<String> internalFlags,
        String blockingUserMessage
) {
}
