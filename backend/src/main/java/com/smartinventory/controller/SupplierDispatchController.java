package com.smartinventory.controller;

import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.SupplierDispatchResponse;
import com.smartinventory.entity.SupplierDispatch;
import com.smartinventory.service.SupplierDispatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/supplier-dispatches")
@RequiredArgsConstructor
public class SupplierDispatchController {

    private final SupplierDispatchService service;

    @PostMapping
    public ResponseEntity<ApiResponse<SupplierDispatchResponse>> dispatchProduct(
            @RequestParam Long supplierProductId,
            @RequestParam Long adminId,
            @RequestParam(required = false) Long branchId,
            @RequestParam Integer quantity) {
        SupplierDispatch dispatch = service.dispatchProduct(supplierProductId, adminId, branchId, quantity);
        return ResponseEntity.ok(ApiResponse.success("Product dispatched successfully", SupplierDispatchResponse.from(dispatch)));
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<ApiResponse<SupplierDispatchResponse>> acceptDispatch(@PathVariable Long id) {
        SupplierDispatch dispatch = service.acceptDispatch(id);
        return ResponseEntity.ok(ApiResponse.success("Delivery accepted", SupplierDispatchResponse.from(dispatch)));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<SupplierDispatchResponse>> rejectDispatch(
            @PathVariable Long id,
            @RequestParam String reason) {
        SupplierDispatch dispatch = service.rejectDispatch(id, reason);
        return ResponseEntity.ok(ApiResponse.success("Delivery rejected", SupplierDispatchResponse.from(dispatch)));
    }

    @GetMapping("/supplier")
    public ResponseEntity<ApiResponse<List<SupplierDispatchResponse>>> getSupplierDispatches() {
        List<SupplierDispatchResponse> list = service.getSupplierDispatches().stream()
                .map(SupplierDispatchResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success("Supplier dispatches retrieved", list));
    }

    @GetMapping("/owner")
    public ResponseEntity<ApiResponse<List<SupplierDispatchResponse>>> getOwnerDispatches() {
        List<SupplierDispatchResponse> list = service.getOwnerDispatches().stream()
                .map(SupplierDispatchResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success("Owner dispatches retrieved", list));
    }
}
