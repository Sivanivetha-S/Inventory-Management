package com.smartinventory.controller;

import com.smartinventory.dto.request.StockVerificationRequest;
import com.smartinventory.dto.request.TheftRecordNotesRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.LossVerificationResponse;
import com.smartinventory.dto.response.TheftRecordResponse;
import com.smartinventory.service.TheftDetectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/theft")
@RequiredArgsConstructor
@Tag(name = "Theft/Loss Detection", description = "Stock verification, damage-aware loss detection endpoints")
public class TheftDetectionController {

    private final TheftDetectionService theftDetectionService;

    @PostMapping("/verify-stock")
    @Operation(summary = "Submit actual stock — damage-aware loss detection + email alert")
    public ResponseEntity<ApiResponse<List<TheftRecordResponse>>> verifyStock(
            @Valid @RequestBody StockVerificationRequest request) {
        return ResponseEntity.ok(theftDetectionService.verifyStock(request));
    }

    @PostMapping("/check-loss")
    @Operation(summary = "Preview loss calculation (no save) — shows expected vs actual vs damage")
    public ResponseEntity<ApiResponse<List<LossVerificationResponse>>> checkLoss(
            @RequestParam List<Long> productIds,
            @RequestParam List<Integer> actualStocks) {
        return ResponseEntity.ok(theftDetectionService.checkDailyLoss(productIds, actualStocks));
    }

    @GetMapping
    @Operation(summary = "Get all inventory loss records")
    public ResponseEntity<ApiResponse<List<TheftRecordResponse>>> getAllTheftRecords() {
        return ResponseEntity.ok(theftDetectionService.getAllTheftRecords());
    }

    @GetMapping("/date/{date}")
    @Operation(summary = "Get loss records by date")
    public ResponseEntity<ApiResponse<List<TheftRecordResponse>>> getByDate(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(theftDetectionService.getTheftRecordsByDate(date));
    }

    @GetMapping("/range")
    @Operation(summary = "Get loss records in date range")
    public ResponseEntity<ApiResponse<List<TheftRecordResponse>>> getByDateRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(theftDetectionService.getTheftRecordsByDateRange(from, to));
    }

    @PatchMapping("/{id}/notes")
    @Operation(summary = "Update notes / status on a loss record")
    public ResponseEntity<ApiResponse<TheftRecordResponse>> updateNotes(
            @PathVariable Long id, @RequestBody TheftRecordNotesRequest request) {
        return ResponseEntity.ok(theftDetectionService.updateTheftNotes(id, request));
    }

    @GetMapping("/product/{productId}")
    @Operation(summary = "Get loss history for a specific product")
    public ResponseEntity<ApiResponse<List<TheftRecordResponse>>> getProductHistory(
            @PathVariable Long productId) {
        return ResponseEntity.ok(theftDetectionService.getProductTheftHistory(productId));
    }
}
