package com.yieldengine.controller.staff;

import com.yieldengine.entity.Reservation;
import com.yieldengine.record.ops.CheckInResponse;
import com.yieldengine.record.ops.QrInspectResponse;
import com.yieldengine.record.ops.ScanQrRequest;
import com.yieldengine.record.ops.VerifyPinRequest;
import com.yieldengine.service.CheckInService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Tag(name = "[ROLE: STAFF / MANAGER] Front-Desk Check-in & No-Show", description = "QR anti-counterfeit inspection, single-use QR scan, 6-digit PIN verification & No-Show forfeiture")
@RestController
@RequestMapping("/api/v1/checkins")
@RequiredArgsConstructor
public class StaffCheckInController {

    private final CheckInService checkInService;

    @Operation(summary = "[STAFF / MANAGER] Inspect customer QR ticket layers & identity")
    @PostMapping("/inspect")
    public ResponseEntity<QrInspectResponse> inspectQr(@Valid @RequestBody ScanQrRequest request) {
        return ResponseEntity.ok(checkInService.inspectQrTicket(request.qrToken()));
    }

    @Operation(summary = "[STAFF / MANAGER] Scan QR code once at venue (UC-16)")
    @PostMapping("/scan")
    public ResponseEntity<CheckInResponse> scanQr(@Valid @RequestBody ScanQrRequest request) {
        return ResponseEntity.ok(checkInService.scanQrCheckIn(request.qrToken(), request.phoneLast4()));
    }

    @Operation(summary = "[STAFF / MANAGER] Verify 6-digit single-use PIN from customer email")
    @PostMapping("/verify-pin")
    public ResponseEntity<CheckInResponse> verifyPin(@Valid @RequestBody VerifyPinRequest request) {
        return ResponseEntity.ok(checkInService.verifyPinCheckIn(
                request.reservationId(),
                request.pinCode(),
                request.phoneLast4()
        ));
    }

    @Operation(summary = "[MANAGER] Manual check-in for venues without front-desk staff (UC-16)")
    @PostMapping("/{reservationId}/manual")
    public ResponseEntity<CheckInResponse> manualCheckIn(@PathVariable UUID reservationId) {
        return ResponseEntity.ok(checkInService.manualCheckIn(reservationId));
    }

    @Operation(summary = "[STAFF / MANAGER] Mark confirmed booking as NO_SHOW & forfeit deposit (UC-17)")
    @PostMapping("/{reservationId}/no-show")
    public ResponseEntity<Map<String, Object>> markNoShow(@PathVariable UUID reservationId) {
        Reservation updated = checkInService.markNoShow(reservationId);
        return ResponseEntity.ok(Map.of(
                "reservationId", updated.getReservationId(),
                "status", updated.getStatus(),
                "forfeitedAmount", updated.getForfeitedAmount()
        ));
    }
}

