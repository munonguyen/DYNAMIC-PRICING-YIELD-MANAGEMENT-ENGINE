package com.yieldengine.service.policy;

import com.yieldengine.entity.CancellationPolicy;
import com.yieldengine.entity.CancellationPolicyTier;
import com.yieldengine.utils.MoneyMathUtils;
import com.yieldengine.utils.TimeAndRangeUtils;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;

/**
 * Pure Domain Policy Evaluator for Deposit calculation, Policy Snapshotting,
 * and Cancellation Refund/Forfeit tier resolution (FR-14, FR-19, FR-21, FR-22, BR-CAN-01..07).
 */
@Component
public class CancellationRefundPolicyEvaluator {

    public record RefundEvaluation(
            long refundAmount,
            long forfeitedAmount,
            int appliedRefundPercent,
            double hoursBeforeStart,
            String reasonCode
    ) {
    }

    public long calculateDepositAmount(long lockedPrice, short depositPercent) {
        return MoneyMathUtils.floorPercentageAmount(lockedPrice, depositPercent);
    }

    public Map<String, Object> createPolicySnapshot(CancellationPolicy policy, short depositPercent) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("depositPercent", (int) depositPercent);
        if (policy == null) {
            snapshot.put("policyName", "NO_POLICY_DEFAULT");
            snapshot.put("tiers", List.of());
            return snapshot;
        }
        snapshot.put("policyId", policy.getId() != null ? policy.getId().toString() : null);
        snapshot.put("policyName", policy.getName());

        List<Map<String, Integer>> tierMaps = policy.getTiers().stream()
                .sorted(Comparator.comparingInt(CancellationPolicyTier::getMinHoursBefore).reversed())
                .map(t -> {
                    Map<String, Integer> m = new LinkedHashMap<>();
                    m.put("minHoursBefore", t.getMinHoursBefore());
                    m.put("refundPercent", (int) t.getRefundPercent());
                    return m;
                })
                .toList();
        snapshot.put("tiers", tierMaps);
        return snapshot;
    }

    @SuppressWarnings("unchecked")
    public RefundEvaluation evaluate(
            long depositAmount,
            Map<String, Object> policySnapshot,
            Instant slotStart,
            Instant dbNow,
            boolean venueInitiated
    ) {
        double hoursBefore = TimeAndRangeUtils.exactHoursBetween(dbNow, slotStart);

        if (depositAmount <= 0) {
            return new RefundEvaluation(0L, 0L, 100, hoursBefore, "ZERO_DEPOSIT");
        }
        if (venueInitiated) {
            return new RefundEvaluation(depositAmount, 0L, 100, hoursBefore, "VENUE_SIDE_FULL_REFUND");
        }

        int matchedRefundPercent = 0;
        if (policySnapshot != null && policySnapshot.get("tiers") instanceof List<?> rawTiers) {
            List<Map<String, Object>> sortedTiers = new ArrayList<>();
            for (Object item : rawTiers) {
                if (item instanceof Map<?, ?> mapItem) {
                    sortedTiers.add((Map<String, Object>) mapItem);
                }
            }
            sortedTiers.sort((a, b) -> Integer.compare(
                    toInt(b.get("minHoursBefore")),
                    toInt(a.get("minHoursBefore"))
            ));

            for (Map<String, Object> tier : sortedTiers) {
                int minHours = toInt(tier.get("minHoursBefore"));
                if (hoursBefore >= minHours) {
                    matchedRefundPercent = Math.min(100, Math.max(0, toInt(tier.get("refundPercent"))));
                    break;
                }
            }
        }

        long refundAmount = MoneyMathUtils.floorPercentageAmount(depositAmount, matchedRefundPercent);
        long forfeitedAmount = depositAmount - refundAmount;
        String reason = matchedRefundPercent > 0 ? "POLICY_TIER_" + matchedRefundPercent + "_PCT" : "LATE_CANCEL_FORFEIT";

        return new RefundEvaluation(refundAmount, forfeitedAmount, matchedRefundPercent, hoursBefore, reason);
    }

    private int toInt(Object val) {
        if (val instanceof Number n) {
            return n.intValue();
        }
        if (val instanceof String s) {
            return Integer.parseInt(s);
        }
        return 0;
    }
}
