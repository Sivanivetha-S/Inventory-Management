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
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final AdminRepository adminRepository;
    private final OtpVerificationRepository otpRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;

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

        return ApiResponse.success("Registration completed successfully! You can now log in.");
    }

    public ApiResponse<AuthResponse> login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        Admin admin = adminRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found"));

        if (!admin.isRegistrationComplete()) {
            throw new BadRequestException("Registration is not complete. Please finish the registration process.");
        }

        String token = jwtUtil.generateToken(admin);

        AdminResponse adminResponse = mapToAdminResponse(admin);
        AuthResponse authResponse = AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .admin(adminResponse)
                .build();

        return ApiResponse.success("Login successful", authResponse);
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

    private void sendOtp(String email, OtpVerification.OtpType type) {
        // Invalidate previous OTPs
        otpRepository.deleteAllByEmailAndOtpType(email, type);

        String otp = generateOtp();
        OtpVerification otpRecord = OtpVerification.builder()
                .email(email)
                .otp(otp)
                .otpType(type)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
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
