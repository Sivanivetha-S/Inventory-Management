package com.smartinventory.controller;

import com.smartinventory.dto.request.BranchRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.BranchResponse;
import com.smartinventory.service.BranchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/branches")
@RequiredArgsConstructor
@Tag(name = "Branch Management", description = "Branch configuration and management endpoints")
@PreAuthorize("hasRole('ADMIN')")
public class BranchController {

    private final BranchService branchService;

    @PostMapping
    @Operation(summary = "Add a new branch")
    public ResponseEntity<ApiResponse<BranchResponse>> addBranch(@Valid @RequestBody BranchRequest request) {
        return ResponseEntity.ok(branchService.addBranch(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update branch details")
    public ResponseEntity<ApiResponse<BranchResponse>> updateBranch(
            @PathVariable Long id, @Valid @RequestBody BranchRequest request) {
        return ResponseEntity.ok(branchService.updateBranch(id, request));
    }

    @PatchMapping("/{id}/toggle")
    @Operation(summary = "Activate or deactivate a branch")
    public ResponseEntity<ApiResponse<BranchResponse>> toggleBranch(@PathVariable Long id) {
        return ResponseEntity.ok(branchService.toggleBranch(id));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a branch")
    public ResponseEntity<ApiResponse<String>> deleteBranch(@PathVariable Long id) {
        return ResponseEntity.ok(branchService.deleteBranch(id));
    }

    @GetMapping
    @Operation(summary = "Get all branches for current owner")
    public ResponseEntity<ApiResponse<List<BranchResponse>>> getAllBranches() {
        return ResponseEntity.ok(branchService.getAllBranches());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get branch details by ID")
    public ResponseEntity<ApiResponse<BranchResponse>> getBranchById(@PathVariable Long id) {
        return ResponseEntity.ok(branchService.getBranchById(id));
    }
}
