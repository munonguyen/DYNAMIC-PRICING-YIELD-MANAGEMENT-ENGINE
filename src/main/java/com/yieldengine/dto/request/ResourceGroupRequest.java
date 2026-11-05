package com.yieldengine.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResourceGroupRequest {

    private UUID tenantId;

    @NotBlank(message = "code is required")
    private String code;

    @NotBlank(message = "name is required")
    private String name;

    @NotNull(message = "totalUnits is required")
    @Min(value = 1, message = "totalUnits must be at least 1")
    private Integer totalUnits;

    @NotNull(message = "basePrice is required")
    @Min(value = 1, message = "basePrice must be positive")
    private Long basePrice;

    @NotNull(message = "minPrice is required")
    @Min(value = 1, message = "minPrice must be positive")
    private Long minPrice;

    @NotNull(message = "maxPrice is required")
    @Min(value = 1, message = "maxPrice must be positive")
    private Long maxPrice;

    @Builder.Default
    private Integer slotMinutes = 60;

    @Builder.Default
    private Integer holdTtlSeconds = 600;
}
