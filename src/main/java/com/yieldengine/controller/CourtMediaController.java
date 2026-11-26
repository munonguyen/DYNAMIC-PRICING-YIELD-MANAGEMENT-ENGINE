package com.yieldengine.controller;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.dto.marketplace.MarketplaceDtos.CourtMediaDto;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.security.SessionPrincipal;
import com.yieldengine.service.CourtMediaStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Court Media Storage", description = "Lessor real court photo upload, gallery listing, and binary serving")
public class CourtMediaController {

    private final CourtMediaStorageService courtMediaStorageService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "List real photos attached to a court group (Public)")
    @GetMapping("/listings/{groupId}/media")
    public ResponseEntity<List<CourtMediaDto>> listCourtMedia(@PathVariable UUID groupId) {
        return ResponseEntity.ok(courtMediaStorageService.listMediaForGroup(groupId));
    }

    @Operation(summary = "Upload authentic venue-owner court photo (MANAGER / STAFF / ADMIN)")
    @PostMapping(value = "/listings/{groupId}/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CourtMediaDto> uploadCourtMedia(
            @PathVariable UUID groupId,
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "caption", required = false) String caption,
            @RequestParam(value = "isCover", defaultValue = "false") boolean isCover
    ) {
        ResourceGroup group = courtMediaStorageService.requireGroupForMediaMutation(groupId);
        SessionPrincipal actor = rbacGuard.requireTenantRoleOrAdmin(
                group.getTenant().getId(),
                SystemConstant.ROLE_MANAGER,
                SystemConstant.ROLE_STAFF
        );
        CourtMediaDto saved = courtMediaStorageService.uploadCourtPhoto(groupId, file, caption, isCover, actor);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @Operation(summary = "Promote an uploaded photo to cover image (MANAGER / STAFF / ADMIN)")
    @PatchMapping("/listings/{groupId}/media/{mediaId}/cover")
    public ResponseEntity<CourtMediaDto> setCoverCourtMedia(
            @PathVariable UUID groupId,
            @PathVariable UUID mediaId
    ) {
        ResourceGroup group = courtMediaStorageService.requireGroupForMediaMutation(groupId);
        SessionPrincipal actor = rbacGuard.requireTenantRoleOrAdmin(
                group.getTenant().getId(),
                SystemConstant.ROLE_MANAGER,
                SystemConstant.ROLE_STAFF
        );
        return ResponseEntity.ok(courtMediaStorageService.setCoverPhoto(groupId, mediaId, actor));
    }

    @Operation(summary = "Delete an uploaded court photo (MANAGER / STAFF / ADMIN)")
    @DeleteMapping("/listings/{groupId}/media/{mediaId}")
    public ResponseEntity<Void> deleteCourtMedia(
            @PathVariable UUID groupId,
            @PathVariable UUID mediaId
    ) {
        ResourceGroup group = courtMediaStorageService.requireGroupForMediaMutation(groupId);
        SessionPrincipal actor = rbacGuard.requireTenantRoleOrAdmin(
                group.getTenant().getId(),
                SystemConstant.ROLE_MANAGER,
                SystemConstant.ROLE_STAFF
        );
        courtMediaStorageService.deleteCourtMedia(groupId, mediaId, actor);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Serve stored court photo binary bytes (Public)")
    @GetMapping("/media/{mediaId}/content")
    public ResponseEntity<Resource> serveMediaContent(@PathVariable UUID mediaId) {
        CourtMediaStorageService.MediaBinaryPayload payload = courtMediaStorageService.loadMediaContent(mediaId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(payload.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + payload.fileName() + "\"")
                .body(payload.resource());
    }
}
