package com.smartinventory.service;

import com.smartinventory.dto.request.BranchRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.BranchResponse;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Branch;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.BranchRepository;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BranchService {

    private final BranchRepository branchRepository;
    private final SecurityUtils securityUtils;

    @Transactional
    public ApiResponse<BranchResponse> addBranch(BranchRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();

        Branch branch = Branch.builder()
                .name(request.getName())
                .address(request.getAddress())
                .city(request.getCity())
                .state(request.getState())
                .pincode(request.getPincode())
                .contactNumber(request.getContactNumber())
                .active(request.getActive() != null ? request.getActive() : true)
                .admin(admin)
                .build();

        branchRepository.save(branch);
        return ApiResponse.success("Branch created successfully", BranchResponse.from(branch));
    }

    @Transactional
    public ApiResponse<BranchResponse> updateBranch(Long id, BranchRequest request) {
        Branch branch = findAndValidate(id);
        branch.setName(request.getName());
        branch.setAddress(request.getAddress());
        branch.setCity(request.getCity());
        branch.setState(request.getState());
        branch.setPincode(request.getPincode());
        branch.setContactNumber(request.getContactNumber());
        if (request.getActive() != null) {
            branch.setActive(request.getActive());
        }
        branchRepository.save(branch);
        return ApiResponse.success("Branch updated successfully", BranchResponse.from(branch));
    }

    @Transactional
    public ApiResponse<BranchResponse> toggleBranch(Long id) {
        Branch branch = findAndValidate(id);
        branch.setActive(!branch.isActive());
        branchRepository.save(branch);
        return ApiResponse.success(
                branch.isActive() ? "Branch activated successfully" : "Branch deactivated successfully",
                BranchResponse.from(branch)
        );
    }

    @Transactional
    public ApiResponse<String> deleteBranch(Long id) {
        Branch branch = findAndValidate(id);
        branchRepository.delete(branch);
        return ApiResponse.success("Branch deleted successfully", "Deleted");
    }

    public ApiResponse<List<BranchResponse>> getAllBranches() {
        Long adminId = securityUtils.getCurrentAdminId();
        List<BranchResponse> list = branchRepository.findAllByAdminId(adminId)
                .stream().map(BranchResponse::from).collect(Collectors.toList());
        return ApiResponse.success("Branches retrieved successfully", list);
    }

    public ApiResponse<BranchResponse> getBranchById(Long id) {
        return ApiResponse.success("Branch retrieved successfully", BranchResponse.from(findAndValidate(id)));
    }

    public Branch findAndValidate(Long id) {
        Long adminId = securityUtils.getCurrentAdminId();
        return branchRepository.findByIdAndAdminId(id, adminId)
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found with ID: " + id));
    }
}
