package com.smartinventory.controller;

import com.smartinventory.dto.request.SupplyRequestCreateRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.SupplyRequestResponse;
import com.smartinventory.service.SupplyRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/supply-requests")
@RequiredArgsConstructor
@Tag(name = "Supply Requests", description = "Owner ↔ Supplier supply workflow")
public class SupplyRequestController {

    private final SupplyRequestService supplyRequestService;

    @PostMapping
    @Operation(summary = "Create a new supply request")
    public ResponseEntity<ApiResponse<SupplyRequestResponse>> create(
            @Valid @RequestBody SupplyRequestCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(supplyRequestService.createRequest(request));
    }

    @GetMapping
    @Operation(summary = "Get all supply requests for current admin")
    public ResponseEntity<ApiResponse<List<SupplyRequestResponse>>> getMyRequests() {
        return ResponseEntity.ok(supplyRequestService.getMyRequests());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get supply request by ID")
    public ResponseEntity<ApiResponse<SupplyRequestResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(supplyRequestService.getById(id));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update supply request status (ACCEPTED / REJECTED / DISPATCHED / RECEIVED)")
    public ResponseEntity<ApiResponse<SupplyRequestResponse>> updateStatus(
            @PathVariable Long id,
            @RequestParam String status,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(supplyRequestService.updateStatus(id, status, notes));
    }
}
