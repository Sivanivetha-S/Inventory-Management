package com.smartinventory.controller;

import com.smartinventory.dto.response.AdminResponse;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.repository.AdminRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/owners")
@RequiredArgsConstructor
@Tag(name = "Owners", description = "Suppliers browse registered shop owners")
public class OwnerController {

    private final AdminRepository adminRepository;
    private final com.smartinventory.repository.BranchRepository branchRepository;

    @GetMapping
    @Operation(summary = "Get all registered shop owners (for suppliers)")
    public ResponseEntity<ApiResponse<List<AdminResponse>>> getAllOwners() {
        List<AdminResponse> owners = adminRepository.findAll().stream()
                .filter(a -> a.isRegistrationComplete() && a.isEmailVerified())
                .map(a -> {
                    List<com.smartinventory.entity.Branch> branches = branchRepository.findAllByAdminId(a.getId());
                    return AdminResponse.builder()
                            .id(a.getId())
                            .fullName(a.getFullName())
                            .shopName(a.getShopName())
                            .shopCategory(a.getShopCategory())
                            .email(a.getEmail())
                            .registrationComplete(a.isRegistrationComplete())
                            .emailVerified(a.isEmailVerified())
                            .createdAt(a.getCreatedAt())
                            .branches(branches == null ? java.util.List.of() : branches.stream()
                                    .map(com.smartinventory.dto.response.BranchResponse::from)
                                    .collect(Collectors.toList()))
                            .build();
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success("Owners retrieved", owners));
    }
}
