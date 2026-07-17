package com.smartinventory.controller;

import com.smartinventory.dto.request.LoginRequest;
import com.smartinventory.dto.request.OtpVerificationRequest;
import com.smartinventory.dto.request.SupplierRegistrationRequest;
import com.smartinventory.dto.response.AdminResponse;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.AuthResponse;
import com.smartinventory.dto.response.SupplierResponse;
import com.smartinventory.service.SupplierService;
import com.smartinventory.util.CookieUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/suppliers")
@RequiredArgsConstructor
@Tag(name = "Suppliers", description = "Supplier registration, login, and management")
public class SupplierController {

    private final SupplierService supplierService;
    private final CookieUtil      cookieUtil;

    /* ── Public endpoints ─────────────────────────────────────────────────── */

    @PostMapping("/register")
    @Operation(summary = "Supplier self-registration — sends OTP")
    public ResponseEntity<ApiResponse<String>> register(
            @Valid @RequestBody SupplierRegistrationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(supplierService.register(request));
    }

    @PostMapping("/verify-otp")
    @Operation(summary = "Verify supplier email OTP")
    public ResponseEntity<ApiResponse<String>> verifyOtp(
            @Valid @RequestBody OtpVerificationRequest request) {
        return ResponseEntity.ok(supplierService.verifyOtp(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Supplier login — sets HttpOnly auth cookie")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        ApiResponse<AuthResponse> result = supplierService.login(request);
        if (result.isSuccess() && result.getData() != null) {
            cookieUtil.setAuthCookie(response, result.getData().getToken());
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/logout")
    @Operation(summary = "Supplier logout — clears auth cookie")
    public ResponseEntity<ApiResponse<String>> logout(HttpServletResponse response) {
        cookieUtil.clearAuthCookie(response);
        return ResponseEntity.ok(ApiResponse.success("Logged out", null));
    }

    /* ── Authenticated endpoints ───────────────────────────────────────────── */

    @GetMapping
    @Operation(summary = "Get all suppliers (Owner view)")
    public ResponseEntity<ApiResponse<List<SupplierResponse>>> getAllSuppliers() {
        return ResponseEntity.ok(supplierService.getAllSuppliers());
    }

    @GetMapping("/shops")
    @Operation(summary = "Get registered owner shops (Supplier view)")
    public ResponseEntity<ApiResponse<List<AdminResponse>>> getRegisteredShops() {
        return ResponseEntity.ok(supplierService.getRegisteredShops());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get supplier by ID")
    public ResponseEntity<ApiResponse<SupplierResponse>> getSupplier(@PathVariable Long id) {
        return ResponseEntity.ok(supplierService.getSupplierById(id));
    }
}
