package com.yieldengine.controller;

import com.yieldengine.dto.request.HoldSlotRequest;
import com.yieldengine.dto.response.HoldSlotResponse;
import com.yieldengine.service.BookingOrchestratorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "3. Booking & Hold Orchestration", description = "ACID write-contention endpoints for holding, confirming, and canceling slots")
@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingOrchestratorService bookingOrchestratorService;

    @Operation(
            summary = "Hold slot with PriceLockToken (ACID Transaction)",
            description = "Validates HMAC-SHA256 signature, enforces Anti-Replay via consumed_tokens, locks available unit with FOR UPDATE SKIP LOCKED, increments held_count, and sets HELD status for 10 minutes."
    )
    @PostMapping("/hold")
    public ResponseEntity<HoldSlotResponse> holdSlot(@Valid @RequestBody HoldSlotRequest request) {
        HoldSlotResponse response = bookingOrchestratorService.holdSlot(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Confirm payment and finalize reservation")
    @PostMapping("/{reservationId}/confirm")
    public ResponseEntity<Void> confirmReservation(@PathVariable UUID reservationId) {
        bookingOrchestratorService.confirmReservation(reservationId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Cancel reservation and release unit back to pool")
    @PostMapping("/{reservationId}/cancel")
    public ResponseEntity<Void> cancelReservation(@PathVariable UUID reservationId) {
        bookingOrchestratorService.cancelReservation(reservationId);
        return ResponseEntity.ok().build();
    }
}
