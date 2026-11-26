package com.yieldengine.dto.marketplace;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class MarketplaceDtos {

    private MarketplaceDtos() {
    }

    public record CreateSportTypeRequest(
            @NotBlank @Size(max = 30) String code,
            @NotBlank @Size(max = 100) String name
    ) {
    }

    public record UpdateVenueSettingsRequest(
            String name,
            String address,
            String phone,
            @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitude,
            @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitude,
            @Pattern(regexp = "QR_STAFF|MANUAL") String checkinMode,
            Boolean isStaffChatEnabled
    ) {
    }

    public record PolicyTierDto(
            @Min(0) int minHoursBefore,
            @Min(0) @Max(100) short refundPercent
    ) {
    }

    public record CreateCancellationPolicyRequest(
            UUID tenantId,
            @NotBlank @Size(max = 100) String name,
            @NotEmpty List<PolicyTierDto> tiers
    ) {
    }

    public record SlotListingQuoteDto(
            Instant slotStart,
            Instant slotEnd,
            int totalCapacity,
            int availableCourts,
            Long currentDynamicPrice
    ) {
    }

    public record CourtMediaDto(
            UUID mediaId,
            UUID groupId,
            String url,
            String fileName,
            String contentType,
            Long fileSizeBytes,
            String caption,
            String sourceType,
            boolean isCover,
            int displayOrder,
            Instant createdAt
    ) {
    }

    public record PublishedListingResponse(
            UUID groupId,
            String groupCode,
            String groupName,
            UUID tenantId,
            String venueName,
            String venueAddress,
            String sportCode,
            String sportName,
            Long basePrice,
            Long minPrice,
            Long maxPrice,
            Short depositPercent,
            Integer slotMinutes,
            String checkinMode,
            String imageUrl,
            List<CourtMediaDto> galleryMedia,
            List<SlotListingQuoteDto> upcomingSlots
    ) {
    }
}

