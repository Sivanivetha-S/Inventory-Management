package com.smartinventory.service;

import com.smartinventory.dto.request.StaffRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.StaffResponse;
import com.smartinventory.email.EmailService;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Branch;
import com.smartinventory.entity.Staff;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.AdminRepository;
import com.smartinventory.repository.BranchRepository;
import com.smartinventory.repository.StaffRepository;
import com.smartinventory.repository.InvoiceRepository;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StaffService {

    private final StaffRepository  staffRepository;
    private final AdminRepository  adminRepository;
    private final InvoiceRepository invoiceRepository;
    private final BranchRepository branchRepository;
    private final PasswordEncoder  passwordEncoder;
    private final EmailService     emailService;
    private final SecurityUtils    securityUtils;

    // ── Add staff (Owner only) ─────────────────────────────────────────────────
    @Transactional
    public ApiResponse<StaffResponse> addStaff(StaffRequest request) {
        Admin admin = currentAdmin();

        if (staffRepository.existsByEmail(request.getEmail()))
            throw new RuntimeException("Email already registered as a staff member");

        if (request.getPassword() == null || request.getPassword().isBlank())
            throw new RuntimeException("Password is required");

        if (request.getPassword().length() < 8)
            throw new RuntimeException("Password must be at least 8 characters");

        Long branchId = request.getBranchId() != null
                ? request.getBranchId()
                : securityUtils.getCurrentBranchId();
        if (branchId == null) throw new RuntimeException("Branch selection is required");
        Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + branchId));

        Staff staff = Staff.builder()
                .admin(admin)
                .branch(branch)
                .fullName(request.getFullName())
                .email(request.getEmail())
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .phoneNumber(request.getPhoneNumber())
                .loginPermission(false)
                .billingPermission(false)
                .emailVerified(true)
                .active(true)
                .build();

        staffRepository.save(staff);

        try {
            emailService.sendStaffWelcomeEmail(
                    staff.getEmail(), staff.getFullName(),
                    admin.getShopName(), request.getPassword());
        } catch (Exception ignored) {}

        return ApiResponse.success("Staff member added successfully", mapToResponse(staff));
    }

    // ── Get all staff ─────────────────────────────────────────────────────────
    public ApiResponse<List<StaffResponse>> getAllStaff() {
        Admin admin = currentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(admin.getId());
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        Branch branch = branchId == null
                ? null
                : branchRepository.findByIdAndAdminId(branchId, admin.getId())
                        .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + branchId));
        List<Staff> list = branch == null
                ? staffRepository.findAllByAdmin(admin)
                : staffRepository.findAllByAdminAndBranch(admin, branch);
        return ApiResponse.success("Staff list retrieved",
                list.stream().map(this::mapToResponse).collect(Collectors.toList()));
    }

    // ── Get one ───────────────────────────────────────────────────────────────
    public ApiResponse<StaffResponse> getStaffById(Long id) {
        return ApiResponse.success("Staff retrieved", mapToResponse(findAndValidate(id)));
    }

    // ── Toggle active ─────────────────────────────────────────────────────────
    @Transactional
    public ApiResponse<StaffResponse> toggleActive(Long id) {
        Staff staff = findAndValidate(id);
        staff.setActive(!staff.isActive());
        staffRepository.save(staff);
        return ApiResponse.success(
                staff.isActive() ? "Staff enabled" : "Staff disabled",
                mapToResponse(staff));
    }

    // ── Toggle billing permission ─────────────────────────────────────────────
    @Transactional
    public ApiResponse<StaffResponse> toggleBillingPermission(Long id) {
        Staff staff = findAndValidate(id);
        staff.setBillingPermission(!staff.isBillingPermission());
        staffRepository.save(staff);
        return ApiResponse.success(
                staff.isBillingPermission() ? "Billing permission granted" : "Billing permission revoked",
                mapToResponse(staff));
    }

    // ── Toggle login permission ─────────────────────────────────────────────
    @Transactional
    public ApiResponse<StaffResponse> toggleLoginPermission(Long id) {
        Staff staff = findAndValidate(id);
        staff.setLoginPermission(!staff.isLoginPermission());
        staffRepository.save(staff);
        return ApiResponse.success(
                staff.isLoginPermission() ? "Login permission enabled" : "Login permission disabled",
                mapToResponse(staff));
    }

    // ── Update ────────────────────────────────────────────────────────────────
    @Transactional
    public ApiResponse<StaffResponse> updateStaff(Long id, StaffRequest request) {
        Staff staff = findAndValidate(id);
        Admin admin = currentAdmin();

        staff.setFullName(request.getFullName());
        staff.setPhoneNumber(request.getPhoneNumber());
        staff.setUsername(request.getUsername());
        if (request.getBillingPermission() != null) {
            staff.setBillingPermission(request.getBillingPermission());
        }
        if (request.getLoginPermission() != null) {
            staff.setLoginPermission(request.getLoginPermission());
        }

        Long branchId = request.getBranchId() != null
                ? request.getBranchId()
                : staff.getBranch() != null ? staff.getBranch().getId() : securityUtils.getCurrentBranchId();
        if (branchId == null) throw new RuntimeException("Branch selection is required");
        Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + branchId));
        staff.setBranch(branch);

        if (request.getPassword() != null && !request.getPassword().isBlank())
            staff.setPassword(passwordEncoder.encode(request.getPassword()));
        staffRepository.save(staff);
        return ApiResponse.success("Staff updated", mapToResponse(staff));
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    @Transactional
    public ApiResponse<String> deleteStaff(Long id) {
        staffRepository.delete(findAndValidate(id));
        return ApiResponse.success("Staff deleted", "Deleted");
    }

    // ── Private helpers ───────────────────────────────────────────────────────
    private Admin currentAdmin() {
        Object principal = SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        if (principal instanceof Admin a) return a;
        String email = SecurityContextHolder.getContext()
                .getAuthentication().getName();
        return adminRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Only the shop owner can manage staff"));
    }

    private Staff findAndValidate(Long id) {
        Admin admin = currentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            return staffRepository.findById(id)
                    .filter(staff -> staff.getAdmin().getId().equals(admin.getId()))
                    .orElseThrow(() -> new RuntimeException("Staff not found"));
        }
        Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + branchId));
        return staffRepository.findByIdAndAdminAndBranch(id, admin, branch)
                .orElseThrow(() -> new RuntimeException("Staff not found"));
    }

    private StaffResponse mapToResponse(Staff s) {
        Long branchId = securityUtils.getCurrentBranchId();
        StaffResponse resp = StaffResponse.from(s);
        resp.setBillsCreated(invoiceRepository.countByStaffAndBranchId(s, branchId));
        return resp;
    }
}
