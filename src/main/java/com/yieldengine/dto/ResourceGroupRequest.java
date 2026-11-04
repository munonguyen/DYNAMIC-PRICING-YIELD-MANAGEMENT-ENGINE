package com.yieldengine.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResourceGroupRequest {

    @NotBlank(message = "code is required")
    private String code;

    @NotBlank(message = "name is required")
    private String name;

    @NotNull(message = "totalUnits is required")
    @Min(value = 1, message = "totalUnits must be at least 1")
    private Integer totalUnits;

    @NotNull(message = "basePrice is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "basePrice must be positive")
    private BigDecimal basePrice;

    @NotNull(message = "minPrice is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "minPrice must be positive")
    private BigDecimal minPrice;

    @NotNull(message = "maxPrice is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "maxPrice must be positive")
    private BigDecimal maxPrice;
}
