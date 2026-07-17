package com.smartinventory.controller;

import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.entity.SupplierTheftRecord;
import com.smartinventory.service.SupplierTheftDetectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/supplier-theft")
@RequiredArgsConstructor
public class SupplierTheftDetectionController {

    private final SupplierTheftDetectionService service;

    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<SupplierTheftRecord>> verifyStock(
            @RequestParam Long supplierProductId,
            @RequestParam Integer actualQuantity) {
        SupplierTheftRecord record = service.verifyStock(supplierProductId, actualQuantity);
        if (record == null) {
            return ResponseEntity.ok(ApiResponse.success("Stock matches expected levels. No discrepancies found.", null));
        }
        return ResponseEntity.ok(ApiResponse.success("Theft alert recorded! Stock updated to actual physical count.", record));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<SupplierTheftRecord>>> getTheftRecords() {
        return ResponseEntity.ok(ApiResponse.success("Theft records retrieved", service.getTheftRecords()));
    }
}
