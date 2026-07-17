package com.smartinventory.controller;

import com.smartinventory.dto.request.CustomerRequest;
import com.smartinventory.dto.request.OtpVerificationRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.CustomerResponse;
import com.smartinventory.service.CustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
@Tag(name = "Customers", description = "Customer management endpoints")
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    @Operation(summary = "Get all customers for logged-in admin")
    public ResponseEntity<ApiResponse<List<CustomerResponse>>> getAllCustomers() {
        return ResponseEntity.ok(customerService.getAllCustomers());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get customer by ID")
    public ResponseEntity<ApiResponse<CustomerResponse>> getCustomerById(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.getCustomerById(id));
    }

    /**
     * Add customer:
     * - If email given → saves as unverified + sends OTP to customer email
     * - Admin calls /verify-otp after customer receives OTP
     * - If no email → saved as verified immediately (walk-in)
     */
    @PostMapping
    @Operation(summary = "Add a new customer (sends OTP if email provided)")
    public ResponseEntity<ApiResponse<CustomerResponse>> createCustomer(
            @Valid @RequestBody CustomerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(customerService.createCustomer(request));
    }

    /**
     * After admin adds a customer with email,
     * admin enters the OTP the customer received → this endpoint verifies it.
     */
    @PostMapping("/verify-otp")
    @Operation(summary = "Verify customer OTP — activates the customer record")
    public ResponseEntity<ApiResponse<CustomerResponse>> verifyCustomerOtp(
            @Valid @RequestBody OtpVerificationRequest request) {
        return ResponseEntity.ok(customerService.verifyCustomerOtp(request));
    }

    /**
     * Resend OTP to a pending (unverified) customer email.
     */
    @PostMapping("/resend-otp")
    @Operation(summary = "Resend OTP to customer email")
    public ResponseEntity<ApiResponse<String>> resendCustomerOtp(@RequestParam String email) {
        return ResponseEntity.ok(customerService.resendCustomerOtp(email));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update customer")
    public ResponseEntity<ApiResponse<CustomerResponse>> updateCustomer(
            @PathVariable Long id, @Valid @RequestBody CustomerRequest request) {
        return ResponseEntity.ok(customerService.updateCustomer(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete customer")
    public ResponseEntity<ApiResponse<String>> deleteCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.deleteCustomer(id));
    }

    @GetMapping("/search")
    @Operation(summary = "Search customers")
    public ResponseEntity<ApiResponse<List<CustomerResponse>>> searchCustomers(
            @RequestParam String q) {
        return ResponseEntity.ok(customerService.searchCustomers(q));
    }

    @GetMapping("/search-by-email")
    @Operation(summary = "Search customer by email")
    public ResponseEntity<ApiResponse<CustomerResponse>> searchByEmail(@RequestParam String email) {
        return ResponseEntity.ok(customerService.searchByEmail(email));
    }

    @PostMapping("/{id}/link-branch")
    @Operation(summary = "Link customer to the active branch")
    public ResponseEntity<ApiResponse<CustomerResponse>> linkBranch(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.linkBranch(id));
    }
}
