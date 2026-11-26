package com.yieldengine.service;

import com.yieldengine.record.finance.CreateCommissionRuleRequest;
import com.yieldengine.record.finance.ReconciliationReportResponse;
import com.yieldengine.record.finance.JournalLeg;
import com.yieldengine.entity.CommissionRule;
import com.yieldengine.entity.LedgerEntry;
import com.yieldengine.entity.LedgerEntryId;
import com.yieldengine.entity.LedgerJournal;
import com.yieldengine.entity.Payment;
import com.yieldengine.entity.Reservation;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.repository.CommissionRuleRepository;
import com.yieldengine.repository.LedgerEntryRepository;
import com.yieldengine.repository.LedgerJournalRepository;
import com.yieldengine.utils.MoneyMathUtils;
import com.yieldengine.utils.TimeAndRangeUtils;
import com.yieldengine.validate.FinanceValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FinanceLedgerService {

    private static final BigDecimal DEFAULT_COMMISSION_RATE = BigDecimal.valueOf(10.00);

    private final CommissionRuleRepository commissionRuleRepository;
    private final LedgerJournalRepository ledgerJournalRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final AuditLogService auditLogService;
    private final FinanceValidator financeValidator;

    @Transactional
    public CommissionRule createCommissionRule(CreateCommissionRuleRequest request, UUID actorUserId) {
        financeValidator.validateCommissionRuleRequest(request);
        String periodRange = TimeAndRangeUtils.toHalfOpenTstzRange(request.effectiveFrom(), request.effectiveTo());

        CommissionRule rule = CommissionRule.builder()
                .tenantId(request.tenantId())
                .sportTypeId(request.sportTypeId())
                .ratePercent(request.ratePercent())
                .commissionBasis(request.commissionBasis() != null ? request.commissionBasis() : "COLLECTED_DEPOSIT")
                .appliesToForfeit(request.appliesToForfeit() != null ? request.appliesToForfeit() : true)
                .effectivePeriod(periodRange)
                .status("ACTIVE")
                .createdBy(actorUserId)
                .build();

        try {
            rule = commissionRuleRepository.saveAndFlush(rule);
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessConflictException("Commission rule period overlaps with an existing active rule for this scope");
        }

        auditLogService.record(
                actorUserId,
                "ACCOUNTANT",
                request.tenantId(),
                "COMMISSION_RULE_CREATED",
                "COMMISSION_RULE",
                rule.getId().toString(),
                Map.of("ratePercent", request.ratePercent(), "period", periodRange)
        );
        return rule;
    }

    @Transactional(readOnly = true)
    public BigDecimal resolveCommissionRate(UUID tenantId, Short sportTypeId, Instant atTime, boolean isForfeit) {
        Optional<CommissionRule> ruleOpt = commissionRuleRepository.findMostSpecificActiveRule(tenantId, sportTypeId, atTime);
        if (ruleOpt.isEmpty()) {
            return DEFAULT_COMMISSION_RATE;
        }
        CommissionRule rule = ruleOpt.get();
        if (isForfeit && Boolean.FALSE.equals(rule.getAppliesToForfeit())) {
            return BigDecimal.ZERO;
        }
        return rule.getRatePercent();
    }

    public long calculateCommissionAmount(long revenueBase, BigDecimal ratePercent) {
        return MoneyMathUtils.halfUpPercentageCapped(revenueBase, ratePercent);
    }

    @Transactional
    public void recordDepositCollected(Reservation reservation, Payment payment) {
        long collected = (payment != null && payment.getAmount() != null && payment.getAmount() > 0)
                ? payment.getAmount()
                : reservation.getDepositAmount();
        if (collected <= 0) {
            return;
        }
        String desc = collected > reservation.getDepositAmount()
                ? "Customer full online payment collected into platform escrow"
                : "Customer deposit collected into platform escrow";
        postBalancedJournal(
                "DEPOSIT_COLLECTED:" + reservation.getReservationId(),
                reservation.getTenantId(),
                reservation.getReservationId(),
                payment != null ? payment.getId() : null,
                "DEPOSIT_COLLECTED",
                desc,
                List.of(
                        new JournalLeg("GATEWAY_CLEARING", "REVENUE", "DEBIT", collected),
                        new JournalLeg("PLATFORM_ESCROW_LIABILITY", "REVENUE", "CREDIT", collected)
                )
        );
    }

    @Transactional
    public void recordRentalCompleted(Reservation reservation, Short sportTypeId) {
        recordRentalCompleted(reservation, sportTypeId, reservation.getDepositAmount());
    }

    @Transactional
    public void recordRentalCompleted(Reservation reservation, Short sportTypeId, long escrowAmount) {
        if (escrowAmount <= 0) {
            return;
        }
        BigDecimal rate = resolveCommissionRate(reservation.getTenantId(), sportTypeId, Instant.now(), false);
        List<JournalLeg> legs = buildEscrowSplitLegs(escrowAmount, rate, "REVENUE", "REVENUE");

        postBalancedJournal(
                "RENTAL_COMPLETED:" + reservation.getReservationId(),
                reservation.getTenantId(),
                reservation.getReservationId(),
                null,
                "RENTAL_COMPLETED",
                "Completed check-in settlement (commission rate " + rate + "%)",
                legs
        );
    }

    @Transactional
    public void recordCancellationSettlement(Reservation reservation, Payment refundPayment, Short sportTypeId) {
        recordCancellationSettlement(reservation, refundPayment, sportTypeId, reservation.getDepositAmount());
    }

    @Transactional
    public void recordCancellationSettlement(
            Reservation reservation,
            Payment refundPayment,
            Short sportTypeId,
            long collectedEscrowAmount
    ) {
        long effectiveEscrow = Math.max(collectedEscrowAmount, reservation.getDepositAmount());
        if (effectiveEscrow <= 0) {
            return;
        }
        long refund = reservation.getRefundAmount();
        long forfeit = reservation.getForfeitedAmount();

        List<JournalLeg> legs = new ArrayList<>();
        legs.add(new JournalLeg("PLATFORM_ESCROW_LIABILITY", "ADJUSTMENT", "DEBIT", effectiveEscrow));

        if (refund > 0) {
            legs.add(new JournalLeg("GATEWAY_CLEARING", "REFUND", "CREDIT", refund));
        }
        if (forfeit > 0) {
            BigDecimal rate = resolveCommissionRate(reservation.getTenantId(), sportTypeId, Instant.now(), true);
            long commission = calculateCommissionAmount(forfeit, rate);
            long venueForfeitNet = forfeit - commission;
            if (commission > 0) {
                legs.add(new JournalLeg("PLATFORM_COMMISSION_REVENUE", "COMMISSION", "CREDIT", commission));
            }
            if (venueForfeitNet > 0) {
                legs.add(new JournalLeg("VENUE_PAYABLE", "FORFEITED_DEPOSIT", "CREDIT", venueForfeitNet));
            }
        }

        postBalancedJournal(
                "CANCELLATION:" + reservation.getReservationId(),
                reservation.getTenantId(),
                reservation.getReservationId(),
                refundPayment != null ? refundPayment.getId() : null,
                "CANCELLATION_REFUND",
                "Cancellation settlement: refund=" + refund + ", forfeit=" + forfeit,
                legs
        );
    }

    @Transactional
    public void recordNoShowForfeit(Reservation reservation, Short sportTypeId) {
        long forfeit = reservation.getForfeitedAmount();
        if (forfeit <= 0) {
            return;
        }
        BigDecimal rate = resolveCommissionRate(reservation.getTenantId(), sportTypeId, Instant.now(), true);
        List<JournalLeg> legs = buildEscrowSplitLegs(forfeit, rate, "FORFEITED_DEPOSIT", "FORFEITED_DEPOSIT");

        postBalancedJournal(
                "NO_SHOW_FORFEIT:" + reservation.getReservationId(),
                reservation.getTenantId(),
                reservation.getReservationId(),
                null,
                "DEPOSIT_FORFEITED",
                "No-show deposit forfeiture settlement",
                legs
        );
    }

    @Transactional
    public LedgerJournal postBalancedJournal(
            String idempotencyKey,
            UUID tenantId,
            UUID reservationId,
            UUID paymentId,
            String eventType,
            String description,
            List<JournalLeg> legs
    ) {
        Optional<LedgerJournal> existing = ledgerJournalRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            log.debug("Idempotent skip for already recorded ledger journal: {}", idempotencyKey);
            return existing.get();
        }

        long totalDebits = legs.stream()
                .filter(l -> "DEBIT".equals(l.direction()))
                .mapToLong(JournalLeg::amount)
                .sum();
        long totalCredits = legs.stream()
                .filter(l -> "CREDIT".equals(l.direction()))
                .mapToLong(JournalLeg::amount)
                .sum();

        financeValidator.validateBalancedJournal(idempotencyKey, totalDebits, totalCredits);

        Instant now = Instant.now();
        LedgerJournal journal = LedgerJournal.builder()
                .idempotencyKey(idempotencyKey)
                .tenantId(tenantId)
                .reservationId(reservationId)
                .paymentId(paymentId)
                .eventType(eventType)
                .totalAmount(totalDebits)
                .currency("VND")
                .description(description)
                .build();
        journal = ledgerJournalRepository.save(journal);

        UUID journalId = journal.getId();
        List<LedgerEntry> entries = legs.stream()
                .map(leg -> LedgerEntry.builder()
                        .id(new LedgerEntryId(UUID.randomUUID(), now))
                        .journalId(journalId)
                        .tenantId(tenantId)
                        .reservationId(reservationId)
                        .paymentId(paymentId)
                        .accountCode(leg.accountCode())
                        .entryType(leg.entryType())
                        .direction(leg.direction())
                        .amount(leg.amount())
                        .currency("VND")
                        .build())
                .toList();
        ledgerEntryRepository.saveAll(entries);
        return journal;
    }

    @Transactional(readOnly = true)
    public Page<LedgerEntry> getLedgerEntries(UUID tenantId, Instant from, Instant to, Pageable pageable) {
        return ledgerEntryRepository.findEntriesFiltered(
                tenantId,
                TimeAndRangeUtils.resolveFromTimeOrEpoch(from),
                TimeAndRangeUtils.resolveToTimeOrNowBuffer(to),
                pageable
        );
    }

    @Transactional(readOnly = true)
    public ReconciliationReportResponse reconcile(UUID tenantId, Instant from, Instant to) {
        Instant f = TimeAndRangeUtils.resolveFromTimeOrEpoch(from);
        Instant t = TimeAndRangeUtils.resolveToTimeOrNowBuffer(to);

        long gatewayDebits = ledgerEntryRepository.sumAmountByAccountAndDirection(tenantId, "GATEWAY_CLEARING", "DEBIT", f, t);
        long gatewayRefundCredits = ledgerEntryRepository.sumAmountByAccountAndDirection(tenantId, "GATEWAY_CLEARING", "CREDIT", f, t);
        long escrowCredits = ledgerEntryRepository.sumAmountByAccountAndDirection(tenantId, "PLATFORM_ESCROW_LIABILITY", "CREDIT", f, t);
        long escrowDebits = ledgerEntryRepository.sumAmountByAccountAndDirection(tenantId, "PLATFORM_ESCROW_LIABILITY", "DEBIT", f, t);
        long commissionCredits = ledgerEntryRepository.sumAmountByAccountAndDirection(tenantId, "PLATFORM_COMMISSION_REVENUE", "CREDIT", f, t);
        long venuePayableCredits = ledgerEntryRepository.sumAmountByAccountAndDirection(tenantId, "VENUE_PAYABLE", "CREDIT", f, t);

        long totalAllDebits = gatewayDebits + escrowDebits;
        long totalAllCredits = gatewayRefundCredits + escrowCredits + commissionCredits + venuePayableCredits;

        long forfeitedDeposits = ledgerEntryRepository.findEntriesFiltered(tenantId, f, t, Pageable.unpaged()).stream()
                .filter(e -> "FORFEITED_DEPOSIT".equals(e.getEntryType()) && "CREDIT".equals(e.getDirection()))
                .mapToLong(LedgerEntry::getAmount)
                .sum();

        return new ReconciliationReportResponse(
                tenantId,
                f,
                t,
                gatewayDebits,
                escrowCredits,
                commissionCredits,
                venuePayableCredits,
                gatewayRefundCredits,
                forfeitedDeposits,
                totalAllDebits == totalAllCredits
        );
    }

    private List<JournalLeg> buildEscrowSplitLegs(
            long escrowAmount, BigDecimal rate, String debitType, String creditVenueType
    ) {
        long commission = calculateCommissionAmount(escrowAmount, rate);
        long venueNet = escrowAmount - commission;

        List<JournalLeg> legs = new ArrayList<>();
        legs.add(new JournalLeg("PLATFORM_ESCROW_LIABILITY", debitType, "DEBIT", escrowAmount));
        if (commission > 0) {
            legs.add(new JournalLeg("PLATFORM_COMMISSION_REVENUE", "COMMISSION", "CREDIT", commission));
        }
        if (venueNet > 0) {
            legs.add(new JournalLeg("VENUE_PAYABLE", creditVenueType, "CREDIT", venueNet));
        }
        return legs;
    }
}
