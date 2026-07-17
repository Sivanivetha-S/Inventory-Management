package com.smartinventory.controller;

import com.smartinventory.dto.request.ProductBatchRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.ProductBatchResponse;
import com.smartinventory.service.ProductBatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/batches")
@RequiredArgsConstructor
@Tag(name = "Product Batches", description = "Batch-wise stock receiving — scan barcode, add stock")
public class ProductBatchController {

    private final ProductBatchService batchService;

    @PostMapping
    @Operation(summary = "Add a new product batch (receive stock from supplier)")
    public ResponseEntity<ApiResponse<ProductBatchResponse>> addBatch(
            @Valid @RequestBody ProductBatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(batchService.addBatch(request));
    }

    @GetMapping
    @Operation(summary = "Get all product batches for this admin")
    public ResponseEntity<ApiResponse<List<ProductBatchResponse>>> getAllBatches() {
        return ResponseEntity.ok(batchService.getAllBatches());
    }

    @GetMapping("/product/{productId}")
    @Operation(summary = "Get all batches for a specific product")
    public ResponseEntity<ApiResponse<List<ProductBatchResponse>>> getBatchesByProduct(
            @PathVariable Long productId) {
        return ResponseEntity.ok(batchService.getBatchesByProduct(productId));
    }

    @GetMapping("/barcode/{barcode}")
    @Operation(summary = "Look up product/batch info by manufacturer barcode")
    public ResponseEntity<ApiResponse<ProductBatchResponse>> lookupByBarcode(
            @PathVariable String barcode) {
        return ResponseEntity.ok(batchService.lookupByBarcode(barcode));
    }
}
