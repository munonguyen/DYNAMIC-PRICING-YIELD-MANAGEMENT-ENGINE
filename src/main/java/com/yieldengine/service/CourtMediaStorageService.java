package com.yieldengine.service;

import com.yieldengine.dto.marketplace.MarketplaceDtos.CourtMediaDto;
import com.yieldengine.dto.marketplace.MediaBinaryPayload;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.entity.ResourceGroupMedia;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.repository.ResourceGroupMediaRepository;
import com.yieldengine.repository.ResourceGroupRepository;
import com.yieldengine.security.SessionPrincipal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class CourtMediaStorageService {

    public static final String SOURCE_LOCAL_DISK = "LOCAL_DISK";
    public static final String SOURCE_STATIC_ASSET = "STATIC_ASSET";
    private static final long MAX_FILE_BYTES = 10L * 1024L * 1024L;

    private final ResourceGroupRepository resourceGroupRepository;
    private final ResourceGroupMediaRepository mediaRepository;
    private final AuditLogService auditLogService;
    private final Path storageRootDir;
    private final int maxFilesPerGroup;

    @Autowired
    public CourtMediaStorageService(
            ResourceGroupRepository resourceGroupRepository,
            ResourceGroupMediaRepository mediaRepository,
            AuditLogService auditLogService,
            @Value("${storage.media.base-dir:./data/uploads/courts}") String mediaBaseDir,
            @Value("${storage.media.max-files-per-group:12}") int maxFilesPerGroup
    ) {
        this.resourceGroupRepository = resourceGroupRepository;
        this.mediaRepository = mediaRepository;
        this.auditLogService = auditLogService;
        this.storageRootDir = Paths.get(mediaBaseDir).toAbsolutePath().normalize();
        this.maxFilesPerGroup = Math.max(1, maxFilesPerGroup);
    }

    @Transactional(readOnly = true)
    public List<CourtMediaDto> listMediaForGroup(UUID groupId) {
        if (!resourceGroupRepository.existsById(groupId)) {
            throw new ResourceNotFoundException("ResourceGroup not found: " + groupId);
        }
        return mediaRepository
                .findByResourceGroupIdOrderByCoverDescDisplayOrderAscCreatedAtAsc(groupId)
                .stream()
                .map(CourtMediaStorageService::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<CourtMediaDto>> listMediaGroupedByGroupIds(Collection<UUID> groupIds) {
        if (groupIds == null || groupIds.isEmpty()) {
            return Map.of();
        }
        return mediaRepository
                .findByResourceGroupIdInOrderByCoverDescDisplayOrderAscCreatedAtAsc(groupIds)
                .stream()
                .map(CourtMediaStorageService::toDto)
                .collect(Collectors.groupingBy(
                        CourtMediaDto::groupId,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
    }

    @Transactional
    public CourtMediaDto uploadCourtPhoto(
            UUID groupId,
            MultipartFile file,
            String caption,
            boolean requestedCover,
            SessionPrincipal actor
    ) {
        ResourceGroup group = requireGroupForMediaMutation(groupId);

        long existingCount = mediaRepository.countByResourceGroupId(groupId);
        if (existingCount >= maxFilesPerGroup) {
            throw new BusinessConflictException("Cụm sân đã đạt giới hạn tối đa " + maxFilesPerGroup + " ảnh thực tế.");
        }

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Tệp ảnh tải lên không được để trống.");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new IllegalArgumentException("Dung lượng ảnh tối đa cho phép là 10MB.");
        }

        byte[] header = readHeaderBytes(file);
        String verifiedContentType = detectVerifiedImageType(header, file.getContentType());
        String extension = extensionForMime(verifiedContentType);

        String storageKey = group.getTenant().getId() + "/" + groupId + "/" + UUID.randomUUID() + "." + extension;
        Path targetPath = resolveSafeDiskPath(storageKey);

        try {
            Files.createDirectories(targetPath.getParent());
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, targetPath, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể lưu tệp ảnh xuống thư mục lưu trữ.", ex);
        }

        boolean shouldBeCover = requestedCover || existingCount == 0;
        if (shouldBeCover && existingCount > 0) {
            mediaRepository.clearCoverForGroup(groupId);
        }

        String sanitizedCaption = caption != null && !caption.isBlank()
                ? caption.trim().substring(0, Math.min(caption.trim().length(), 240))
                : "Ảnh thực tế chủ sân tải lên • Góc nhìn trực tiếp tại sân";

        ResourceGroupMedia saved = mediaRepository.save(ResourceGroupMedia.builder()
                .resourceGroupId(groupId)
                .tenantId(group.getTenant().getId())
                .fileName(sanitizeFileName(file.getOriginalFilename(), extension))
                .contentType(verifiedContentType)
                .fileSizeBytes(file.getSize())
                .storageKey(storageKey)
                .storageSource(SOURCE_LOCAL_DISK)
                .caption(sanitizedCaption)
                .cover(shouldBeCover)
                .displayOrder((int) existingCount)
                .uploadedBy(actor != null ? actor.userId() : null)
                .build());

        auditLogService.record(
                actor != null ? actor.userId() : null,
                actor != null ? actor.primaryRoleCode() : null,
                group.getTenant().getId(),
                "COURT_MEDIA_UPLOADED",
                "RESOURCE_GROUP_MEDIA",
                saved.getId() != null ? saved.getId().toString() : storageKey,
                Map.of(
                        "groupId", groupId.toString(),
                        "storageKey", storageKey,
                        "isCover", shouldBeCover,
                        "fileSizeBytes", file.getSize()
                )
        );

        log.info("Stored real venue photo {} for group {} (tenant={}, size={}B)",
                saved.getId(), groupId, group.getTenant().getId(), file.getSize());
        return toDto(saved);
    }

    @Transactional
    public CourtMediaDto setCoverPhoto(UUID groupId, UUID mediaId, SessionPrincipal actor) {
        ResourceGroupMedia media = getMediaOwnedByGroup(groupId, mediaId);
        mediaRepository.clearCoverForGroup(groupId);
        media.setCover(true);
        ResourceGroupMedia saved = mediaRepository.save(media);

        auditLogService.record(
                actor != null ? actor.userId() : null,
                actor != null ? actor.primaryRoleCode() : null,
                media.getTenantId(),
                "COURT_MEDIA_COVER_CHANGED",
                "RESOURCE_GROUP_MEDIA",
                mediaId.toString(),
                Map.of("groupId", groupId.toString())
        );
        return toDto(saved);
    }

    @Transactional
    public void deleteCourtMedia(UUID groupId, UUID mediaId, SessionPrincipal actor) {
        ResourceGroupMedia media = getMediaOwnedByGroup(groupId, mediaId);
        boolean wasCover = media.isCover();
        String storageKey = media.getStorageKey();
        String storageSource = media.getStorageSource();
        UUID tenantId = media.getTenantId();

        mediaRepository.delete(media);
        mediaRepository.flush();

        if (wasCover) {
            mediaRepository
                    .findByResourceGroupIdOrderByCoverDescDisplayOrderAscCreatedAtAsc(groupId)
                    .stream()
                    .findFirst()
                    .ifPresent(next -> {
                        next.setCover(true);
                        mediaRepository.save(next);
                    });
        }

        if (SOURCE_LOCAL_DISK.equals(storageSource)) {
            Path diskFile = resolveSafeDiskPath(storageKey);
            try {
                Files.deleteIfExists(diskFile);
            } catch (IOException ex) {
                log.warn("Could not delete orphaned media file {}: {}", diskFile, ex.getMessage());
            }
        }

        auditLogService.record(
                actor != null ? actor.userId() : null,
                actor != null ? actor.primaryRoleCode() : null,
                tenantId,
                "COURT_MEDIA_DELETED",
                "RESOURCE_GROUP_MEDIA",
                mediaId.toString(),
                Map.of("groupId", groupId.toString(), "storageKey", storageKey)
        );
    }

    @Transactional(readOnly = true)
    public MediaBinaryPayload loadMediaContent(UUID mediaId) {
        ResourceGroupMedia media = mediaRepository.findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Court media not found: " + mediaId));

        if (!SOURCE_LOCAL_DISK.equals(media.getStorageSource())) {
            throw new ResourceNotFoundException("Media asset is served as a static bundle resource: " + mediaId);
        }

        Path path = resolveSafeDiskPath(media.getStorageKey());
        if (!Files.exists(path) || !Files.isReadable(path)) {
            throw new ResourceNotFoundException("Stored image file is missing on disk: " + mediaId);
        }

        try {
            Resource resource = new UrlResource(path.toUri());
            return new MediaBinaryPayload(
                    resource,
                    media.getContentType(),
                    media.getFileName(),
                    media.getFileSizeBytes()
            );
        } catch (MalformedURLException ex) {
            throw new ResourceNotFoundException("Invalid stored image URI: " + mediaId);
        }
    }

    @Transactional(readOnly = true)
    public ResourceGroup requireGroupForMediaMutation(UUID groupId) {
        return resourceGroupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("ResourceGroup not found: " + groupId));
    }

    private ResourceGroupMedia getMediaOwnedByGroup(UUID groupId, UUID mediaId) {
        ResourceGroupMedia media = mediaRepository.findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Court media not found: " + mediaId));
        if (!media.getResourceGroupId().equals(groupId)) {
            throw new ResourceNotFoundException("Court media " + mediaId + " does not belong to group " + groupId);
        }
        return media;
    }

    private Path resolveSafeDiskPath(String storageKey) {
        Path resolved = storageRootDir.resolve(storageKey).normalize();
        if (!resolved.startsWith(storageRootDir)) {
            throw new IllegalArgumentException("Đường dẫn lưu trữ ảnh không hợp lệ.");
        }
        return resolved;
    }

    public static CourtMediaDto toDto(ResourceGroupMedia media) {
        String publicUrl = SOURCE_STATIC_ASSET.equals(media.getStorageSource())
                ? media.getStorageKey()
                : "/api/v1/media/" + media.getId() + "/content";

        return new CourtMediaDto(
                media.getId(),
                media.getResourceGroupId(),
                publicUrl,
                media.getFileName(),
                media.getContentType(),
                media.getFileSizeBytes(),
                media.getCaption(),
                media.getStorageSource(),
                media.isCover(),
                media.getDisplayOrder(),
                media.getCreatedAt()
        );
    }

    private static byte[] readHeaderBytes(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            byte[] buf = new byte[12];
            int read = in.readNBytes(buf, 0, buf.length);
            return Arrays.copyOf(buf, read);
        } catch (IOException ex) {
            throw new IllegalArgumentException("Không thể đọc dữ liệu ảnh tải lên.", ex);
        }
    }

    private static String detectVerifiedImageType(byte[] h, String declaredContentType) {
        if (h.length >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) {
            return MediaType.IMAGE_JPEG_VALUE;
        }
        if (h.length >= 8
                && (h[0] & 0xFF) == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47
                && h[4] == 0x0D && h[5] == 0x0A && h[6] == 0x1A && h[7] == 0x0A) {
            return MediaType.IMAGE_PNG_VALUE;
        }
        if (h.length >= 12
                && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') {
            return "image/webp";
        }
        throw new IllegalArgumentException(
                "Định dạng ảnh không hợp lệ (" + declaredContentType + "). Chỉ chấp nhận JPEG, PNG hoặc WebP thực tế."
        );
    }

    private static String extensionForMime(String mime) {
        return switch (mime) {
            case MediaType.IMAGE_PNG_VALUE -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
    }

    private static String sanitizeFileName(String originalName, String fallbackExt) {
        if (originalName == null || originalName.isBlank()) {
            return "court-photo." + fallbackExt;
        }
        String base = Paths.get(originalName).getFileName().toString()
                .replaceAll("[^a-zA-Z0-9._-]", "_");
        return base.length() > 120 ? base.substring(0, 120) : base;
    }
}
