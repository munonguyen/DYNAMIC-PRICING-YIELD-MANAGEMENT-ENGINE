package com.yieldengine.controller.lessor;

import com.yieldengine.constant.SystemConstant;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.record.marketplace.CourtMediaDto;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.service.CourtMediaStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Tag(name = "[ROLE: MANAGER / STAFF] Court Photo Management", description = "Upload, promote cover photo and delete court gallery images")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class LessorCourtMediaController {

    private final CourtMediaStorageService courtMediaStorageService;
    private final RbacGuard rbacGuard;

    @Operation(summary = "[MANAGER / STAFF / ADMIN] Upload authentic venue-owner court photo")
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

    @Operation(summary = "[MANAGER / STAFF / ADMIN] Promote an uploaded photo to cover image")
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

    @Operation(summary = "[MANAGER / STAFF / ADMIN] Delete an uploaded court photo")
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
}

