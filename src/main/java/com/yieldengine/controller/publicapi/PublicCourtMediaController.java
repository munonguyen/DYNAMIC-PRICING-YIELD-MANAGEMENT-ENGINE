package com.yieldengine.controller.publicapi;

import com.yieldengine.record.marketplace.CourtMediaDto;
import com.yieldengine.record.marketplace.MediaBinaryPayload;
import com.yieldengine.service.CourtMediaStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Tag(name = "[PUBLIC] Court Media Gallery", description = "Public endpoints to view court gallery metadata and serve image bytes")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PublicCourtMediaController {

    private final CourtMediaStorageService courtMediaStorageService;

    @Operation(summary = "[PUBLIC] List photos attached to a court group")
    @GetMapping("/listings/{groupId}/media")
    public ResponseEntity<List<CourtMediaDto>> listCourtMedia(@PathVariable UUID groupId) {
        return ResponseEntity.ok(courtMediaStorageService.listMediaForGroup(groupId));
    }

    @Operation(summary = "[PUBLIC] Serve stored court photo binary bytes")
    @GetMapping("/media/{mediaId}/content")
    public ResponseEntity<Resource> serveMediaContent(@PathVariable UUID mediaId) {
        MediaBinaryPayload payload = courtMediaStorageService.loadMediaContent(mediaId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(payload.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + payload.fileName() + "\"")
                .body(payload.resource());
    }
}

