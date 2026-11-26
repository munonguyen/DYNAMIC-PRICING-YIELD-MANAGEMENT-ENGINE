package com.yieldengine.record.marketplace;

import java.util.List;
import java.util.UUID;
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
        List<SlotListingQuoteDto> upcomingSlots,
        boolean published,
        List<CourtAddOn> addOnServices,
        boolean staffChatEnabled
) {
}
