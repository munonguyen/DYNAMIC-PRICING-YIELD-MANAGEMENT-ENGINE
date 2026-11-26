package com.yieldengine;

import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.dto.request.ResourceGroupRequest;
import com.yieldengine.utils.CommonTextAndPageUtils;
import com.yieldengine.utils.CryptoHashUtils;
import com.yieldengine.utils.MoneyMathUtils;
import com.yieldengine.utils.TimeAndRangeUtils;
import com.yieldengine.validate.FinanceValidator;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Shared Utils & Jakarta/Domain Validators Unit Tests")
class UtilsAndValidatorsUnitTest {

    private static Validator beanValidator;

    @BeforeAll
    static void initValidator() {
        beanValidator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    @DisplayName("CryptoHashUtils: SHA-256 hex, HMAC-SHA256 Base64URL, constant-time equality & random token")
    void testCryptoHashUtils() {
        String hash1 = CryptoHashUtils.sha256Hex("payload-1");
        String hash2 = CryptoHashUtils.sha256Hex("payload-1");
        assertEquals(64, hash1.length());
        assertEquals(hash1, hash2);

        String sig = CryptoHashUtils.hmacSha256Base64Url("data", "secret-key-256-bits-long-value!!");
        assertTrue(CryptoHashUtils.constantTimeEquals(sig, CryptoHashUtils.hmacSha256Base64Url("data", "secret-key-256-bits-long-value!!")));
        assertFalse(CryptoHashUtils.constantTimeEquals(sig, "tampered"));

        String token = CryptoHashUtils.generateSecureUrlToken(32);
        assertTrue(token.length() >= 40);
    }

    @Test
    @DisplayName("MoneyMathUtils & TimeAndRangeUtils: Rounding, clamping, percentage floor & tstzrange format")
    void testMoneyAndTimeUtils() {
        assertEquals(275_000L, MoneyMathUtils.roundAndClampPrice(BigDecimal.valueOf(275_400), 120_000L, 350_000L));
        assertEquals(350_000L, MoneyMathUtils.roundAndClampPrice(BigDecimal.valueOf(431_250), 120_000L, 350_000L));
        assertEquals(35_000L, MoneyMathUtils.floorPercentageAmount(100_000L, 35));
        assertEquals(7_000L, MoneyMathUtils.halfUpPercentageCapped(70_000L, BigDecimal.TEN));

        Instant start = Instant.parse("2026-12-01T10:00:00Z");
        Instant end = Instant.parse("2026-12-01T11:00:00Z");
        assertEquals("[\"2026-12-01T10:00:00Z\", \"2026-12-01T11:00:00Z\")", TimeAndRangeUtils.toHalfOpenTstzRange(start, end));
        assertEquals(200, CommonTextAndPageUtils.boundedPageable(0, 999, 200).getPageSize());
    }

    @Test
    @DisplayName("Jakarta @ValidPriceBounds & @ValidSlotWindow reject invalid bounds cleanly")
    void testCustomJakartaValidators() {
        ResourceGroupRequest invalidGroup = ResourceGroupRequest.builder()
                .code("COURT_ERR")
                .name("Invalid Bounds Group")
                .totalUnits(4)
                .minPrice(300_000L)
                .basePrice(200_000L)
                .maxPrice(350_000L)
                .slotMinutes(45)
                .build();
        assertFalse(beanValidator.validate(invalidGroup).isEmpty());

        CreateTimeSlotRequest invalidSlot = CreateTimeSlotRequest.builder()
                .groupId(UUID.randomUUID())
                .slotStart(Instant.parse("2026-12-01T12:00:00Z"))
                .slotEnd(Instant.parse("2026-12-01T10:00:00Z"))
                .contextMultiplier(BigDecimal.ONE)
                .build();
        assertFalse(beanValidator.validate(invalidSlot).isEmpty());

        FinanceValidator financeValidator = new FinanceValidator();
        assertThrows(IllegalStateException.class,
                () -> financeValidator.validateBalancedJournal("J-1", 70_000L, 65_000L));
    }
}

