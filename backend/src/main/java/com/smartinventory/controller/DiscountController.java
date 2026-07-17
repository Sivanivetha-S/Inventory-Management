package com.smartinventory.controller;

import com.smartinventory.dto.request.DiscountRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.DiscountResponse;
import com.smartinventory.service.DiscountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/discounts")
@RequiredArgsConstructor
@Tag(name = "Discounts", description = "Discount management endpoints")
public class DiscountController {

    private final DiscountService discountService;

    @GetMapping
    @Operation(summary = "Get all discounts")
    public ResponseEntity<ApiResponse<List<DiscountResponse>>> getAllDiscounts() {
        return ResponseEntity.ok(discountService.getAllDiscounts());
    }

    @GetMapping("/active")
    @Operation(summary = "Get active discounts")
    public ResponseEntity<ApiResponse<List<DiscountResponse>>> getActiveDiscounts() {
        return ResponseEntity.ok(discountService.getActiveDiscounts());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get discount by ID")
    public ResponseEntity<ApiResponse<DiscountResponse>> getDiscountById(@PathVariable Long id) {
        return ResponseEntity.ok(discountService.getDiscountById(id));
    }

    @PostMapping
    @Operation(summary = "Create discount")
    public ResponseEntity<ApiResponse<DiscountResponse>> createDiscount(
            @Valid @RequestBody DiscountRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(discountService.createDiscount(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update discount")
    public ResponseEntity<ApiResponse<DiscountResponse>> updateDiscount(
            @PathVariable Long id, @Valid @RequestBody DiscountRequest request) {
        return ResponseEntity.ok(discountService.updateDiscount(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete discount")
    public ResponseEntity<ApiResponse<String>> deleteDiscount(@PathVariable Long id) {
        return ResponseEntity.ok(discountService.deleteDiscount(id));
    }
}
