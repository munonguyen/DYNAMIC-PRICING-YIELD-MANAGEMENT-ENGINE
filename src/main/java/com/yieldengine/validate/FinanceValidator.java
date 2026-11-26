package com.yieldengine.validate;

import com.yieldengine.record.finance.CreateCommissionRuleRequest;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Validator for Commission Rule bounds and Double-Entry Financial Ledger invariants (UC-19, UC-20, NFR-13).
 */
@Component
public class FinanceValidator {

    public void validateCommissionRuleRequest(CreateCommissionRuleRequest request) {
        if (!request.effectiveTo().isAfter(request.effectiveFrom())) {
            throw new IllegalArgumentException("effectiveTo must be strictly after effectiveFrom");
        }
        if (request.ratePercent().compareTo(BigDecimal.ZERO) < 0
                || request.ratePercent().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalArgumentException("ratePercent must be between 0.00 and 100.00");
        }
    }

    public void validateBalancedJournal(String idempotencyKey, long totalDebits, long totalCredits) {
        if (totalDebits <= 0 || totalDebits != totalCredits) {
            throw new IllegalStateException(String.format(
                    "Unbalanced double-entry journal %s: debits=%d != credits=%d",
                    idempotencyKey, totalDebits, totalCredits
            ));
        }
    }
}

