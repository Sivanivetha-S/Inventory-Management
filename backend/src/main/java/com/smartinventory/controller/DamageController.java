package com.smartinventory.controller;

import com.smartinventory.dto.request.DamageRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.DamageResponse;
import com.smartinventory.service.DamageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/damage")
@RequiredArgsConstructor
@Tag(name = "Damage Records", description = "Inventory damage entry and history endpoints")
public class DamageController {

    private final DamageService damageService;

    @PostMapping
    @Operation(summary = "Record a new damage entry — deducts from stock")
    public ResponseEntity<ApiResponse<DamageResponse>> recordDamage(
            @Valid @RequestBody DamageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(damageService.recordDamage(request));
    }

    @GetMapping
    @Operation(summary = "Get all damage records for this admin")
    public ResponseEntity<ApiResponse<List<DamageResponse>>> getAllDamageRecords() {
        return ResponseEntity.ok(damageService.getAllDamageRecords());
    }

    @GetMapping("/date/{date}")
    @Operation(summary = "Get damage records by date")
    public ResponseEntity<ApiResponse<List<DamageResponse>>> getByDate(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(damageService.getDamageByDate(date));
    }

    @GetMapping("/range")
    @Operation(summary = "Get damage records in date range")
    public ResponseEntity<ApiResponse<List<DamageResponse>>> getByDateRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(damageService.getDamageByDateRange(from, to));
    }

    @GetMapping("/product/{productId}")
    @Operation(summary = "Get damage history for a specific product")
    public ResponseEntity<ApiResponse<List<DamageResponse>>> getProductHistory(
            @PathVariable Long productId) {
        return ResponseEntity.ok(damageService.getProductDamageHistory(productId));
    }
}
