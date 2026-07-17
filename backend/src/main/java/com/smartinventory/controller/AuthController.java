package com.smartinventory.controller;

import com.smartinventory.dto.request.*;
import com.smartinventory.dto.response.*;
import com.smartinventory.service.AuthService;
import com.smartinventory.util.CookieUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Admin registration and login")
public class AuthController {

    private final AuthService authService;
    private final CookieUtil  cookieUtil;

    @PostMapping("/register/step1")
    @Operation(summary = "Step 1 — Submit basic info and receive OTP")
    public ResponseEntity<ApiResponse<String>> registerStep1(
            @Valid @RequestBody AdminRegistrationStep1Request request) {
        return ResponseEntity.ok(authService.registerStep1(request));
    }

    @PostMapping("/register/verify-otp")
    @Operation(summary = "Step 2 — Verify OTP sent to email")
    public ResponseEntity<ApiResponse<String>> verifyOtp(
            @Valid @RequestBody OtpVerificationRequest request) {
        return ResponseEntity.ok(authService.verifyOtp(request));
    }

    @PostMapping("/register/step3")
    @Operation(summary = "Step 3 — Complete registration with shop details")
    public ResponseEntity<ApiResponse<String>> registerStep3(
            @Valid @RequestBody AdminRegistrationStep3Request request) {
        return ResponseEntity.ok(authService.registerStep3(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Owner login — sets HttpOnly auth cookie")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        ApiResponse<AuthResponse> result = authService.login(request);
        // Write JWT into HttpOnly cookie
        if (result.isSuccess() && result.getData() != null) {
            cookieUtil.setAuthCookie(response, result.getData().getToken());
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout — clears auth cookie")
    public ResponseEntity<ApiResponse<String>> logout(HttpServletResponse response) {
        cookieUtil.clearAuthCookie(response);
        return ResponseEntity.ok(ApiResponse.success("Logged out successfully", null));
    }

    @PostMapping("/resend-otp")
    @Operation(summary = "Resend OTP to email")
    public ResponseEntity<ApiResponse<String>> resendOtp(@RequestParam String email) {
        return ResponseEntity.ok(authService.resendOtp(email));
    }

    @GetMapping("/profile")
    @Operation(summary = "Get logged-in admin profile")
    public ResponseEntity<ApiResponse<AdminResponse>> getProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(authService.getProfile(userDetails.getUsername()));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Request password reset OTP")
    public ResponseEntity<ApiResponse<String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request));
    }

    @PostMapping("/forgot-password/verify-otp")
    @Operation(summary = "Verify password reset OTP")
    public ResponseEntity<ApiResponse<String>> verifyResetOtp(
            @Valid @RequestBody OtpVerificationRequest request) {
        return ResponseEntity.ok(authService.verifyResetOtp(request));
    }

    @PostMapping("/forgot-password/reset")
    @Operation(summary = "Reset password using verified OTP")
    public ResponseEntity<ApiResponse<String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }
}
