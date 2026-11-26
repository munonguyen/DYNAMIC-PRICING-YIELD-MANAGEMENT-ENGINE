package com.yieldengine.service;

import com.yieldengine.dto.marketplace.MarketplaceDtos.CourtMediaDto;
import com.yieldengine.entity.ResourceGroup;
import com.yieldengine.entity.ResourceGroupMedia;
import com.yieldengine.entity.Tenant;
import com.yieldengine.exception.BusinessConflictException;
import com.yieldengine.repository.ResourceGroupMediaRepository;
import com.yieldengine.repository.ResourceGroupRepository;
import com.yieldengine.security.SessionPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CourtMediaStorageService Unit Tests")
class CourtMediaStorageServiceTest {

    @Mock
    private ResourceGroupRepository resourceGroupRepository;
    @Mock
    private ResourceGroupMediaRepository mediaRepository;
    @Mock
    private AuditLogService auditLogService;

    @TempDir
    Path tempDir;

    private CourtMediaStorageService service;
    private UUID tenantId;
    private UUID groupId;
    private ResourceGroup group;
    private SessionPrincipal managerActor;

    @BeforeEach
    void setUp() {
        service = new CourtMediaStorageService(
                resourceGroupRepository,
                mediaRepository,
                auditLogService,
                tempDir.toString(),
                4
        );
        tenantId = UUID.randomUUID();
        groupId = UUID.randomUUID();

        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setName("Sân Cầu Lông Phú Nhuận");

        group = new ResourceGroup();
        group.setId(groupId);
        group.setTenant(tenant);
        group.setCode("BADMINTON_PRO");
        group.setName("Sân thảm Yonex");

        managerActor = new SessionPrincipal(
                UUID.randomUUID(),
                "owner_phunhuan",
                List.of(new SessionPrincipal.RoleGrant("MANAGER", "TENANT", tenantId)),
                Instant.now().minusSeconds(60),
                Instant.now().plusSeconds(3600)
        );
    }

    @Test
    @DisplayName("Persists authentic JPEG photo to disk, assigns first photo as cover & streams binary")
    void uploadValidJpegPersistsFileAndServesContent() throws Exception {
        byte[] validJpeg = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F'};
        MockMultipartFile file = new MockMultipartFile("file", "../evil/photo-court.jpg", "image/jpeg", validJpeg);

        UUID savedMediaId = UUID.randomUUID();
        when(resourceGroupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(mediaRepository.countByResourceGroupId(groupId)).thenReturn(0L);
        when(mediaRepository.save(any(ResourceGroupMedia.class))).thenAnswer(inv -> {
            ResourceGroupMedia entity = inv.getArgument(0);
            entity.setId(savedMediaId);
            entity.setCreatedAt(Instant.now());
            return entity;
        });

        CourtMediaDto dto = service.uploadCourtPhoto(groupId, file, "Ảnh góc nhìn khu vực nghỉ", false, managerActor);

        assertEquals(savedMediaId, dto.mediaId());
        assertEquals("/api/v1/media/" + savedMediaId + "/content", dto.url());
        assertEquals("image/jpeg", dto.contentType());
        assertEquals("photo-court.jpg", dto.fileName());
        assertTrue(dto.isCover());
        assertEquals("Ảnh góc nhìn khu vực nghỉ", dto.caption());

        ArgumentCaptor<ResourceGroupMedia> captor = ArgumentCaptor.forClass(ResourceGroupMedia.class);
        verify(mediaRepository).save(captor.capture());
        ResourceGroupMedia persisted = captor.getValue();
        Path writtenPath = tempDir.resolve(persisted.getStorageKey()).normalize();
        assertTrue(writtenPath.startsWith(tempDir));
        assertTrue(Files.exists(writtenPath));
        assertArrayEquals(validJpeg, Files.readAllBytes(writtenPath));

        when(mediaRepository.findById(savedMediaId)).thenReturn(Optional.of(persisted));
        CourtMediaStorageService.MediaBinaryPayload payload = service.loadMediaContent(savedMediaId);
        assertEquals("image/jpeg", payload.contentType());
        assertTrue(payload.resource().exists());
    }

    @Test
    @DisplayName("Rejects spoofed non-image binary even when filename/Content-Type claim JPEG")
    void rejectsSpoofedImagePayload() {
        byte[] textPayload = "<html><script>alert(1)</script></html>".getBytes();
        MockMultipartFile spoofed = new MockMultipartFile("file", "fake.jpg", "image/jpeg", textPayload);

        when(resourceGroupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(mediaRepository.countByResourceGroupId(groupId)).thenReturn(0L);

        assertThrows(IllegalArgumentException.class,
                () -> service.uploadCourtPhoto(groupId, spoofed, "test", true, managerActor));
        verify(mediaRepository, never()).save(any());
    }

    @Test
    @DisplayName("Enforces per-court photo limit and cleans up physical file on delete")
    void enforcesQuotaAndDeletesFileFromDisk() throws Exception {
        when(resourceGroupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(mediaRepository.countByResourceGroupId(groupId)).thenReturn(4L);

        byte[] pngHeader = new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00};
        MockMultipartFile file = new MockMultipartFile("file", "court.png", "image/png", pngHeader);
        assertThrows(BusinessConflictException.class,
                () -> service.uploadCourtPhoto(groupId, file, "quota hit", false, managerActor));

        UUID mediaId = UUID.randomUUID();
        String relKey = tenantId + "/" + groupId + "/" + mediaId + ".png";
        Path stored = tempDir.resolve(relKey);
        Files.createDirectories(stored.getParent());
        Files.write(stored, pngHeader);

        ResourceGroupMedia existing = ResourceGroupMedia.builder()
                .resourceGroupId(groupId)
                .tenantId(tenantId)
                .fileName("court.png")
                .contentType("image/png")
                .fileSizeBytes(pngHeader.length)
                .storageKey(relKey)
                .storageSource(CourtMediaStorageService.SOURCE_LOCAL_DISK)
                .cover(true)
                .displayOrder(0)
                .build();
        existing.setId(mediaId);

        when(mediaRepository.findById(mediaId)).thenReturn(Optional.of(existing));
        when(mediaRepository.findByResourceGroupIdOrderByCoverDescDisplayOrderAscCreatedAtAsc(groupId))
                .thenReturn(List.of());

        service.deleteCourtMedia(groupId, mediaId, managerActor);
        verify(mediaRepository).delete(existing);
        assertFalse(Files.exists(stored));
    }
}
