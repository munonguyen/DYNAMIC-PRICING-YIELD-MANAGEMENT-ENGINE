package com.yieldengine.controller;

import com.yieldengine.dto.ops.BookingOpsDtos.*;
import com.yieldengine.entity.Conversation;
import com.yieldengine.entity.Message;
import com.yieldengine.entity.Reservation;
import com.yieldengine.service.ChatService;
import com.yieldengine.service.CheckInService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Tag(name = "4. Venue Operations: QR Check-in, No-Show & Chat", description = "Single-use QR verification, Manual check-in, Grace-period No-Show & Immutable Chat")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CheckInAndChatController {

    private final CheckInService checkInService;
    private final ChatService chatService;

    @Operation(summary = "Inspect customer QR code and verify anti-counterfeit layers + identity before check-in")
    @PostMapping("/checkins/inspect")
    public ResponseEntity<QrInspectResponse> inspectQr(@Valid @RequestBody ScanQrRequest request) {
        return ResponseEntity.ok(checkInService.inspectQrTicket(request.qrToken()));
    }

    @Operation(summary = "Scan customer QR code to check in once at venue (STAFF/MANAGER - UC-16)")
    @PostMapping("/checkins/scan")
    public ResponseEntity<CheckInResponse> scanQr(@Valid @RequestBody ScanQrRequest request) {
        return ResponseEntity.ok(checkInService.scanQrCheckIn(request.qrToken()));
    }

    @Operation(summary = "Manual check-in for venues operating without staff (MANAGER - UC-16)")
    @PostMapping("/checkins/{reservationId}/manual")
    public ResponseEntity<CheckInResponse> manualCheckIn(@PathVariable UUID reservationId) {
        return ResponseEntity.ok(checkInService.manualCheckIn(reservationId));
    }

    @Operation(summary = "Mark confirmed reservation as NO_SHOW after grace period & forfeit deposit (UC-17)")
    @PostMapping("/checkins/{reservationId}/no-show")
    public ResponseEntity<Map<String, Object>> markNoShow(@PathVariable UUID reservationId) {
        Reservation updated = checkInService.markNoShow(reservationId);
        return ResponseEntity.ok(Map.of(
                "reservationId", updated.getReservationId(),
                "status", updated.getStatus(),
                "forfeitedAmount", updated.getForfeitedAmount()
        ));
    }

    @Operation(summary = "Open or retrieve conversation thread between User and Venue (UC-18)")
    @PostMapping("/conversations")
    public ResponseEntity<Conversation> openConversation(@Valid @RequestBody OpenConversationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(chatService.openOrGetConversation(request));
    }

    @Operation(summary = "List conversations for current user or venue")
    @GetMapping("/conversations")
    public ResponseEntity<List<Conversation>> listConversations(@RequestParam(required = false) UUID tenantId) {
        return ResponseEntity.ok(chatService.listMyConversations(tenantId));
    }

    @Operation(summary = "Send immutable message in conversation (checks staff_chat_enabled - UC-18)")
    @PostMapping("/conversations/{id}/messages")
    public ResponseEntity<Message> sendMessage(
            @PathVariable UUID id,
            @Valid @RequestBody SendMessageRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(chatService.sendMessage(id, request));
    }

    @Operation(summary = "Read messages in conversation & update read marker (UC-18)")
    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<Message>> getMessages(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return ResponseEntity.ok(chatService.getMessages(id, limit));
    }
}

