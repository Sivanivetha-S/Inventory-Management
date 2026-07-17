package com.smartinventory.controller;

import com.smartinventory.dto.request.StaffRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.StaffResponse;
import com.smartinventory.service.StaffService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
@Tag(name = "Staff Management", description = "Owner manages staff members")
public class StaffController {

    private final StaffService staffService;

    @PostMapping
    @Operation(summary = "Add a new staff member (Owner only)")
    public ResponseEntity<ApiResponse<StaffResponse>> addStaff(
            @Valid @RequestBody StaffRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(staffService.addStaff(request));
    }

    @GetMapping
    @Operation(summary = "Get all staff for the logged-in owner")
    public ResponseEntity<ApiResponse<List<StaffResponse>>> getAllStaff() {
        return ResponseEntity.ok(staffService.getAllStaff());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get staff member by ID")
    public ResponseEntity<ApiResponse<StaffResponse>> getStaff(@PathVariable Long id) {
        return ResponseEntity.ok(staffService.getStaffById(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update staff member")
    public ResponseEntity<ApiResponse<StaffResponse>> updateStaff(
            @PathVariable Long id, @Valid @RequestBody StaffRequest request) {
        return ResponseEntity.ok(staffService.updateStaff(id, request));
    }

    @PatchMapping("/{id}/toggle")
    @Operation(summary = "Enable or disable a staff member")
    public ResponseEntity<ApiResponse<StaffResponse>> toggleStaff(@PathVariable Long id) {
        return ResponseEntity.ok(staffService.toggleActive(id));
    }

    @PatchMapping("/{id}/toggle-login")
    @Operation(summary = "Enable or disable login permission for a staff member")
    public ResponseEntity<ApiResponse<StaffResponse>> toggleLogin(@PathVariable Long id) {
        return ResponseEntity.ok(staffService.toggleLoginPermission(id));
    }

    @PatchMapping("/{id}/toggle-billing")
    @Operation(summary = "Enable or disable billing permission for a staff member")
    public ResponseEntity<ApiResponse<StaffResponse>> toggleBilling(@PathVariable Long id) {
        return ResponseEntity.ok(staffService.toggleBillingPermission(id));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete staff member")
    public ResponseEntity<ApiResponse<String>> deleteStaff(@PathVariable Long id) {
        return ResponseEntity.ok(staffService.deleteStaff(id));
    }
}
