package com.yieldengine.record.ops;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

@JsonIgnoreProperties(ignoreUnknown = true)
public record VietQrBankNotice(
        @JsonAlias("bankAccount") @NotBlank @Pattern(regexp = "[A-Za-z0-9]{1,40}") String bankaccount,
        @NotNull @DecimalMin("1") @Digits(integer = 12, fraction = 0) BigDecimal amount,
        @NotBlank @Pattern(regexp = "[CD]") String transType,
        @NotNull @Size(max = 255) String content,
        @JsonAlias("transactionId") @NotBlank @Size(max = 128) String transactionid,
        @JsonAlias("transactionTime") @NotNull @Positive Long transactiontime,
        @JsonAlias("referenceNumber") @NotBlank @Size(max = 128) String referencenumber,
        @Size(max = 13) String orderId
) {
}
