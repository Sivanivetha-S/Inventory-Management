package com.smartinventory.service;

import com.smartinventory.dto.request.LoginRequest;
import com.smartinventory.dto.request.OtpVerificationRequest;
import com.smartinventory.dto.request.SupplierRegistrationRequest;
import com.smartinventory.dto.response.AdminResponse;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.AuthResponse;
import com.smartinventory.dto.response.SupplierResponse;
import com.smartinventory.email.EmailService;
import com.smartinventory.entity.OtpVerification;
import com.smartinventory.entity.Supplier;
import com.smartinventory.repository.AdminRepository;
import com.smartinventory.repository.BranchRepository;
import com.smartinventory.repository.OtpVerificationRepository;
import com.smartinventory.repository.SupplierRepository;
import com.smartinventory.dto.response.BranchResponse;
import com.smartinventory.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final AdminRepository adminRepository;
    private final OtpVerificationRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final JwtUtil jwtUtil;
    private final BranchRepository branchRepository;

    @Value("${otp.expiry.minutes:10}")
    private int otpExpiryMinutes;

    // ── Register Step 1: save unverified + send OTP ───────────────────────────
    @Transactional
    public ApiResponse<String> register(SupplierRegistrationRequest request) {
        String email = normalizeEmail(request.getEmail());
        Supplier supplier;
        if (supplierRepository.existsByEmail(email)) {
            supplier = supplierRepository.findByEmail(email).get();
            if (supplier.isEmailVerified()) {
                throw new RuntimeException("Email already registered");
            }
            // Update existing unverified supplier record
            supplier.setCompanyName(request.getCompanyName());
            supplier.setSupplierName(request.getSupplierName());
            supplier.setPassword(passwordEncoder.encode(request.getPassword()));
            supplier.setPhoneNumber(request.getPhoneNumber());
            supplier.setAddress(request.getAddress());
            supplier.setLocation(request.getLocation());
        } else {
            supplier = Supplier.builder()
                    .companyName(request.getCompanyName())
                    .supplierName(request.getSupplierName())
                    .email(email)
                    .password(passwordEncoder.encode(request.getPassword()))
                    .phoneNumber(request.getPhoneNumber())
                    .address(request.getAddress())
                    .location(request.getLocation())
                    .emailVerified(false)
                    .build();
        }
        supplierRepository.save(supplier);

        // Generate OTP, save it, then send email
        String otp = generateAndSaveOtp(email, OtpVerification.OtpType.SUPPLIER_REGISTRATION);
        emailService.sendSupplierOtpEmail(email, request.getSupplierName(), otp);

        return ApiResponse.success("OTP sent to your email. Please verify.", null);
    }

    // ── Verify OTP ────────────────────────────────────────────────────────────
    @Transactional
    public ApiResponse<String> verifyOtp(OtpVerificationRequest request) {
        String email = normalizeEmail(request.getEmail());
        OtpVerification otp = otpRepository
                .findTopByEmailAndOtpTypeAndUsedFalseOrderByCreatedAtDesc(
                        email, OtpVerification.OtpType.SUPPLIER_REGISTRATION)
                .orElseThrow(() -> new RuntimeException("OTP not found"));

        if (otp.isExpired()) throw new RuntimeException("OTP has expired");
        if (!otp.getOtp().equals(request.getOtp())) throw new RuntimeException("Invalid OTP");

        otp.setUsed(true);
        otpRepository.save(otp);

        Supplier supplier = supplierRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Supplier not found"));
        supplier.setEmailVerified(true);
        supplierRepository.save(supplier);

        return ApiResponse.success("Email verified successfully. You can now login.", null);
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    public ApiResponse<AuthResponse> login(LoginRequest request) {
        String email = normalizeEmail(request.getEmail());
        Supplier supplier = supplierRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));
        if (!passwordEncoder.matches(request.getPassword(), supplier.getPassword())) {
            throw new BadCredentialsException("Invalid email or password");
        }
        if (!supplier.isEmailVerified()) throw new RuntimeException("Email not verified. Please verify your email first.");
        if (!supplier.isActive()) throw new RuntimeException("Your supplier account has been deactivated.");
        String token = jwtUtil.generateToken(
                Map.of("role", "SUPPLIER"), supplier);
        return ApiResponse.success("Login successful",
                AuthResponse.builder()
                        .token(token)
                        .role("SUPPLIER")
                        .supplier(SupplierResponse.from(supplier))
                        .build());
    }

    // ── Get all suppliers (for Admin view) ────────────────────────────────────
    public ApiResponse<List<SupplierResponse>> getAllSuppliers() {
        List<SupplierResponse> list = supplierRepository.findAll()
                .stream().map(SupplierResponse::from).collect(Collectors.toList());
        return ApiResponse.success("Suppliers retrieved", list);
    }

    // ── Get one ───────────────────────────────────────────────────────────────
    public ApiResponse<SupplierResponse> getSupplierById(Long id) {
        Supplier s = supplierRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Supplier not found"));
        return ApiResponse.success("Supplier retrieved", SupplierResponse.from(s));
    }



    public ApiResponse<List<AdminResponse>> getRegisteredShops() {
        List<AdminResponse> shops = adminRepository.findAll().stream()
                .filter(a -> a.isEmailVerified() && a.isRegistrationComplete())
                .map(a -> {
                    List<BranchResponse> branches = branchRepository.findAllByAdminId(a.getId()).stream()
                            .map(BranchResponse::from)
                            .collect(Collectors.toList());
                    return AdminResponse.builder()
                            .id(a.getId())
                            .fullName(a.getFullName())
                            .email(a.getEmail())
                            .phoneNumber(a.getPhoneNumber())
                            .shopName(a.getShopName())
                            .shopCategory(a.getShopCategory())
                            .emailVerified(a.isEmailVerified())
                            .registrationComplete(a.isRegistrationComplete())
                            .createdAt(a.getCreatedAt())
                            .branches(branches)
                            .build();
                })
                .collect(Collectors.toList());
        return ApiResponse.success("Registered shops retrieved", shops);
    }

    // ── Private helpers ───────────────────────────────────────────────────────
    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private String generateAndSaveOtp(String email, OtpVerification.OtpType type) {
        otpRepository.deleteAllByEmailAndOtpType(email, type);
        String otp = String.format("%06d", new Random().nextInt(999999));
        otpRepository.save(OtpVerification.builder()
                .email(email)
                .otp(otp)
                .otpType(type)
                .expiresAt(LocalDateTime.now().plusMinutes(otpExpiryMinutes))
                .build());
        return otp;
    }
}
