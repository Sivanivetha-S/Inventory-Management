package com.smartinventory.service;

import com.smartinventory.dto.request.*;
import com.smartinventory.dto.response.*;
import com.smartinventory.email.EmailService;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.OtpVerification;
import com.smartinventory.exception.BadRequestException;
import com.smartinventory.exception.DuplicateResourceException;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.AdminRepository;
import com.smartinventory.repository.OtpVerificationRepository;
import com.smartinventory.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.smartinventory.entity.Branch;
import com.smartinventory.repository.BranchRepository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final AdminRepository adminRepository;
    private final com.smartinventory.repository.StaffRepository staffRepository;
    private final OtpVerificationRepository otpRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final BranchRepository branchRepository;

    @Value("${otp.expiry.minutes:10}")
    private int otpExpiryMinutes;

    @Transactional
    public ApiResponse<String> registerStep1(AdminRegistrationStep1Request request) {
        String email = normalizeEmail(request.getEmail());

        if (adminRepository.existsByEmail(email)) {
            Admin existing = adminRepository.findByEmail(email).get();
            if (existing.isRegistrationComplete()) {
                throw new DuplicateResourceException("Email already registered");
            }
            // Allow re-registration attempt — update existing incomplete record
            existing.setFullName(request.getFullName());
            existing.setPassword(passwordEncoder.encode(request.getPassword()));
            existing.setPhoneNumber(request.getPhoneNumber());
            existing.setEmailVerified(false);
            adminRepository.save(existing);
        } else {
            Admin admin = Admin.builder()
                    .fullName(request.getFullName())
                    .email(email)
                    .password(passwordEncoder.encode(request.getPassword()))
                    .phoneNumber(request.getPhoneNumber())
                    .emailVerified(false)
                    .registrationComplete(false)
                    .build();
            adminRepository.save(admin);
        }

        sendOtp(email, OtpVerification.OtpType.ADMIN_REGISTRATION);
        return ApiResponse.success("OTP sent to " + email + ". Please verify your email.");
    }

    @Transactional
    public ApiResponse<String> verifyOtp(OtpVerificationRequest request) {
        String email = normalizeEmail(request.getEmail());
        OtpVerification otpRecord = otpRepository
                .findTopByEmailAndOtpTypeAndUsedFalseOrderByCreatedAtDesc(
                        email, OtpVerification.OtpType.ADMIN_REGISTRATION)
                .orElseThrow(() -> new BadRequestException("No OTP found for this email"));

        if (otpRecord.isExpired()) {
            throw new BadRequestException("OTP has expired. Please request a new one.");
        }
        if (!otpRecord.getOtp().equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP. Please try again.");
        }

        otpRecord.setUsed(true);
        otpRepository.save(otpRecord);

        Admin admin = adminRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found"));
        admin.setEmailVerified(true);
        adminRepository.save(admin);

        return ApiResponse.success("Email verified successfully. Please complete your registration.");
    }

    @Transactional
    public ApiResponse<String> registerStep3(AdminRegistrationStep3Request request) {
        String email = normalizeEmail(request.getEmail());
        Admin admin = adminRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found"));

        if (!admin.isEmailVerified()) {
            throw new BadRequestException("Email not verified. Please complete OTP verification first.");
        }

        admin.setShopName(request.getShopName());
        admin.setShopCategory(request.getShopCategory());
        admin.setRegistrationComplete(true);
        adminRepository.save(admin);

        // Auto-create a default branch for the new owner so they have a branch context!
        Branch defaultBranch = Branch.builder()
                .name("Main Branch")
                .address("Not Specified")
                .city("Not Specified")
                .state("Not Specified")
                .pincode("000000")
                .contactNumber(admin.getPhoneNumber() != null ? admin.getPhoneNumber() : "0000000000")
                .active(true)
                .admin(admin)
                .build();
        branchRepository.save(defaultBranch);

        return ApiResponse.success("Registration completed successfully! You can now log in.");
    }

    public ApiResponse<AuthResponse> login(LoginRequest request) {
        // Pre-check staff login permission to return the exact validation message requested
        java.util.Optional<com.smartinventory.entity.Staff> preStaffOpt = staffRepository.findByEmail(request.getEmail());
        if (preStaffOpt.isPresent()) {
            com.smartinventory.entity.Staff staff = preStaffOpt.get();
            if (!staff.isLoginPermission()) {
                throw new BadRequestException("Your account has not been activated by the Owner. Please contact your administrator.");
            }
            if (!staff.isActive()) {
                throw new BadRequestException("Account is deactivated. Please contact the Owner.");
            }
        }

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        // 1. Try Admin (Owner)
        java.util.Optional<Admin> adminOpt = adminRepository.findByEmail(request.getEmail());
        if (adminOpt.isPresent()) {
            Admin admin = adminOpt.get();
            if (!admin.isRegistrationComplete()) {
                throw new BadRequestException("Registration is not complete. Please finish the registration process.");
            }
            String token = jwtUtil.generateToken(java.util.Map.of("role", "ADMIN"), admin);
            AdminResponse adminResponse = mapToAdminResponse(admin);
            return ApiResponse.success("Login successful", AuthResponse.builder()
                    .token(token)
                    .tokenType("Bearer")
                    .role("ADMIN")
                    .admin(adminResponse)
                    .build());
        }

        // 2. Try Staff
        java.util.Optional<com.smartinventory.entity.Staff> staffOpt = staffRepository.findByEmail(request.getEmail());
        if (staffOpt.isPresent()) {
            com.smartinventory.entity.Staff staff = staffOpt.get();
            if (!staff.isActive()) {
                throw new BadRequestException("Account is deactivated. Please contact the Owner.");
            }
            staff.setLastLoginTime(LocalDateTime.now());
            staffRepository.save(staff);

            String token = jwtUtil.generateToken(java.util.Map.of("role", "STAFF"), staff);
            return ApiResponse.success("Login successful", AuthResponse.builder()
                    .token(token)
                    .tokenType("Bearer")
                    .role("STAFF")
                    .staff(StaffResponse.from(staff))
                    .build());
        }

        throw new ResourceNotFoundException("User not found");
    }

    @Transactional
    public ApiResponse<String> resendOtp(String email) {
        String normalizedEmail = normalizeEmail(email);
        adminRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found with email: " + normalizedEmail));
        sendOtp(normalizedEmail, OtpVerification.OtpType.ADMIN_REGISTRATION);
        return ApiResponse.success("OTP resent to " + normalizedEmail);
    }

    public ApiResponse<AdminResponse> getProfile(String email) {
        Admin admin = adminRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found"));
        return ApiResponse.success("Profile retrieved", mapToAdminResponse(admin));
    }

    @Transactional
    public ApiResponse<String> forgotPassword(ForgotPasswordRequest request) {
        String email = normalizeEmail(request.getEmail());
        Admin admin = adminRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found with email: " + email));

        if (!admin.isRegistrationComplete()) {
            throw new BadRequestException("Registration is not complete. Please finish registration first.");
        }

        sendForgotPasswordOtp(email);
        return ApiResponse.success("OTP sent to " + email + ". Please verify.");
    }

    @Transactional
    public ApiResponse<String> verifyResetOtp(OtpVerificationRequest request) {
        String email = normalizeEmail(request.getEmail());
        OtpVerification otpRecord = otpRepository
                .findTopByEmailAndOtpTypeAndUsedFalseOrderByCreatedAtDesc(
                        email, OtpVerification.OtpType.FORGOT_PASSWORD)
                .orElseThrow(() -> new BadRequestException("No OTP found for this email"));

        if (otpRecord.isExpired()) {
            throw new BadRequestException("OTP has expired. Please request a new one.");
        }
        if (!otpRecord.getOtp().equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP. Please try again.");
        }

        return ApiResponse.success("OTP verified successfully.");
    }

    @Transactional
    public ApiResponse<String> resetPassword(ResetPasswordRequest request) {
        String email = normalizeEmail(request.getEmail());
        Admin admin = adminRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found"));

        OtpVerification otpRecord = otpRepository
                .findTopByEmailAndOtpTypeAndUsedFalseOrderByCreatedAtDesc(
                        email, OtpVerification.OtpType.FORGOT_PASSWORD)
                .orElseThrow(() -> new BadRequestException("No OTP found for this email"));

        if (otpRecord.isExpired()) {
            throw new BadRequestException("OTP has expired. Please request a new one.");
        }
        if (!otpRecord.getOtp().equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP. Please try again.");
        }

        otpRecord.setUsed(true);
        otpRepository.save(otpRecord);

        admin.setPassword(passwordEncoder.encode(request.getNewPassword()));
        adminRepository.save(admin);

        return ApiResponse.success("Password reset successfully.");
    }

    private void sendForgotPasswordOtp(String email) {
        otpRepository.deleteAllByEmailAndOtpType(email, OtpVerification.OtpType.FORGOT_PASSWORD);

        String otp = generateOtp();
        OtpVerification otpRecord = OtpVerification.builder()
                .email(email)
                .otp(otp)
                .otpType(OtpVerification.OtpType.FORGOT_PASSWORD)
                .expiresAt(LocalDateTime.now().plusMinutes(otpExpiryMinutes))
                .used(false)
                .build();
        otpRepository.save(otpRecord);

        String name = adminRepository.findByEmail(email)
                .map(Admin::getFullName).orElse("User");
        emailService.sendOtpEmail(email, otp, name);
    }

    private void sendOtp(String email, OtpVerification.OtpType type) {
        // Invalidate previous OTPs
        otpRepository.deleteAllByEmailAndOtpType(email, type);

        String otp = generateOtp();
        OtpVerification otpRecord = OtpVerification.builder()
                .email(email)
                .otp(otp)
                .otpType(type)
                .expiresAt(LocalDateTime.now().plusMinutes(otpExpiryMinutes))
                .used(false)
                .build();
        otpRepository.save(otpRecord);

        // Get admin name for email
        String name = adminRepository.findByEmail(email)
                .map(Admin::getFullName).orElse("User");
        emailService.sendOtpEmail(email, otp, name);
    }

    private String generateOtp() {
        Random random = new Random();
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public AdminResponse mapToAdminResponse(Admin admin) {
        return AdminResponse.builder()
                .id(admin.getId())
                .fullName(admin.getFullName())
                .email(admin.getEmail())
                .phoneNumber(admin.getPhoneNumber())
                .shopName(admin.getShopName())
                .shopCategory(admin.getShopCategory())
                .emailVerified(admin.isEmailVerified())
                .registrationComplete(admin.isRegistrationComplete())
                .createdAt(admin.getCreatedAt())
                .build();
    }
}
