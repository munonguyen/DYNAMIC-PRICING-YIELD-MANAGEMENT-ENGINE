package com.yieldengine.controller.staff;

import com.yieldengine.entity.Conversation;
import com.yieldengine.entity.Message;
import com.yieldengine.record.ops.OpenConversationRequest;
import com.yieldengine.record.ops.SendMessageRequest;
import com.yieldengine.service.ChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "[ROLE: STAFF / USER / MANAGER] Venue Support Chat", description = "Live venue messaging threads controlled by tenant staff-chat policy")
@RestController
@RequestMapping("/api/v1/conversations")
@RequiredArgsConstructor
public class VenueChatController {

    private final ChatService chatService;

    @Operation(summary = "[USER / STAFF / MANAGER] Open or retrieve conversation thread (UC-18)")
    @PostMapping
    public ResponseEntity<Conversation> openConversation(@Valid @RequestBody OpenConversationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(chatService.openOrGetConversation(request));
    }

    @Operation(summary = "[USER / STAFF / MANAGER] List conversations for current user or venue")
    @GetMapping
    public ResponseEntity<List<Conversation>> listConversations(@RequestParam(required = false) UUID tenantId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(chatService.listMyConversations(tenantId, page, size));
    }

    @Operation(summary = "[USER / STAFF / MANAGER] Send immutable message in conversation (UC-18)")
    @PostMapping("/{id}/messages")
    public ResponseEntity<Message> sendMessage(
            @PathVariable UUID id,
            @Valid @RequestBody SendMessageRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(chatService.sendMessage(id, request));
    }

    @Operation(summary = "[USER / STAFF / MANAGER] Read messages in conversation (UC-18)")
    @GetMapping("/{id}/messages")
    public ResponseEntity<List<Message>> getMessages(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return ResponseEntity.ok(chatService.getMessages(id, limit));
    }
}

