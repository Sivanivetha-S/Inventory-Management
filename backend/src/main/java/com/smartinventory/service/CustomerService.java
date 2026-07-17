package com.smartinventory.service;

import com.smartinventory.dto.request.CustomerRequest;
import com.smartinventory.dto.request.OtpVerificationRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.CustomerResponse;
import com.smartinventory.email.EmailService;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Customer;
import com.smartinventory.entity.OtpVerification;
import com.smartinventory.exception.BadRequestException;
import com.smartinventory.exception.DuplicateResourceException;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.CustomerRepository;
import com.smartinventory.repository.OtpVerificationRepository;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final OtpVerificationRepository otpRepository;
    private final EmailService emailService;
    private final SecurityUtils securityUtils;

    public ApiResponse<List<CustomerResponse>> getAllCustomers() {
        Long adminId = securityUtils.getCurrentAdminId();
        List<CustomerResponse> customers = customerRepository.findByAdminId(adminId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Customers retrieved", customers);
    }

    public ApiResponse<CustomerResponse> getCustomerById(Long id) {
        Customer customer = findByIdAndAdmin(id);
        return ApiResponse.success("Customer retrieved", mapToResponse(customer));
    }

    /**
     * Add customer flow:
     * - If email is provided → save as unverified + send OTP to customer email
     * - Admin must then call /verify-otp to confirm
     * - If no email → save as verified immediately (walk-in)
     */
    @Transactional
    public ApiResponse<CustomerResponse> createCustomer(CustomerRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();

        boolean hasEmail = request.getEmail() != null && !request.getEmail().trim().isEmpty();

        // Check duplicate email within same admin's customers
        if (hasEmail && customerRepository.existsByEmailAndAdminId(request.getEmail(), admin.getId())) {
            throw new DuplicateResourceException(
                    "Customer with email " + request.getEmail() + " already exists");
        }

        Customer customer = Customer.builder()
                .admin(admin)
                .name(request.getName())
                .email(hasEmail ? request.getEmail().trim() : null)
                .phoneNumber(request.getPhoneNumber())
                .address(request.getAddress())
                .emailVerified(!hasEmail) // no email = walk-in, auto-verified
                .build();
        customer = customerRepository.save(customer);

        if (hasEmail) {
            try {
                sendCustomerOtp(request.getEmail().trim(), request.getName(), admin.getId());
            } catch (Exception e) {
                log.error("Failed to send OTP to customer email {}: {}", request.getEmail(), e.getMessage());
                // Still return success — customer saved, admin can resend OTP manually
                return ApiResponse.success(
                        "Customer saved but OTP email failed: " + e.getMessage()
                        + ". Use 'Resend OTP' to retry.",
                        mapToResponse(customer));
            }
            return ApiResponse.success(
                    "OTP sent to " + request.getEmail() + ". Customer will be activated after verification.",
                    mapToResponse(customer));
        }

        return ApiResponse.success("Customer added successfully", mapToResponse(customer));
    }

    /**
     * Verify the OTP sent to the customer's email.
     * Only after this succeeds is the customer considered active/verified.
     */
    @Transactional
    public ApiResponse<CustomerResponse> verifyCustomerOtp(OtpVerificationRequest request) {
        Long adminId = securityUtils.getCurrentAdminId();

        OtpVerification otpRecord = otpRepository
                .findTopByEmailAndOtpTypeAndUsedFalseOrderByCreatedAtDesc(
                        request.getEmail(), OtpVerification.OtpType.CUSTOMER_REGISTRATION)
                .orElseThrow(() -> new BadRequestException("No OTP found for this email. Please add the customer again."));

        if (otpRecord.isExpired()) {
            throw new BadRequestException("OTP has expired. Please delete and re-add the customer to resend OTP.");
        }
        if (!otpRecord.getOtp().equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP. Please try again.");
        }

        otpRecord.setUsed(true);
        otpRepository.save(otpRecord);

        // Find the pending (unverified) customer under this admin with this email
        Customer customer = customerRepository
                .findByEmailAndAdminIdAndEmailVerifiedFalse(request.getEmail(), adminId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No pending customer found for email: " + request.getEmail()));

        customer.setEmailVerified(true);
        customer = customerRepository.save(customer);

        return ApiResponse.success("Customer email verified! Customer is now active.", mapToResponse(customer));
    }

    @Transactional
    public ApiResponse<CustomerResponse> updateCustomer(Long id, CustomerRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();
        Customer customer = findByIdAndAdmin(id);

        if (request.getEmail() != null
                && !request.getEmail().equals(customer.getEmail())
                && customerRepository.existsByEmailAndAdminId(request.getEmail(), admin.getId())) {
            throw new DuplicateResourceException("Email already in use by another customer");
        }

        customer.setName(request.getName());
        customer.setEmail(request.getEmail());
        customer.setPhoneNumber(request.getPhoneNumber());
        customer.setAddress(request.getAddress());
        customer = customerRepository.save(customer);
        return ApiResponse.success("Customer updated successfully", mapToResponse(customer));
    }

    @Transactional
    public ApiResponse<String> deleteCustomer(Long id) {
        Customer customer = findByIdAndAdmin(id);
        customerRepository.delete(customer);
        return ApiResponse.success("Customer deleted successfully");
    }

    public ApiResponse<List<CustomerResponse>> searchCustomers(String search) {
        Long adminId = securityUtils.getCurrentAdminId();
        List<CustomerResponse> customers = customerRepository.searchByAdminId(adminId, search)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Search results", customers);
    }

    @Transactional
    public ApiResponse<String> resendCustomerOtp(String email) {
        Admin admin = securityUtils.getCurrentAdmin();
        Customer customer = customerRepository
                .findByEmailAndAdminIdAndEmailVerifiedFalse(email, admin.getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No pending customer found for email: " + email));
        sendCustomerOtp(email, customer.getName(), admin.getId());
        return ApiResponse.success("OTP resent to " + email);
    }

    private void sendCustomerOtp(String email, String name, Long adminId) {
        otpRepository.deleteAllByEmailAndOtpType(email, OtpVerification.OtpType.CUSTOMER_REGISTRATION);
        String otp = String.valueOf(100000 + new Random().nextInt(900000));
        OtpVerification record = OtpVerification.builder()
                .email(email).otp(otp)
                .otpType(OtpVerification.OtpType.CUSTOMER_REGISTRATION)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .used(false).build();
        otpRepository.save(record);
        emailService.sendOtpEmail(email, otp, name);
    }

    public Customer findByIdAndAdmin(Long id) {
        Long adminId = securityUtils.getCurrentAdminId();
        return customerRepository.findByIdAndAdminId(id, adminId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id));
    }

    public Customer findById(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id));
    }

    public CustomerResponse mapToResponse(Customer customer) {
        return CustomerResponse.builder()
                .id(customer.getId())
                .name(customer.getName())
                .email(customer.getEmail())
                .phoneNumber(customer.getPhoneNumber())
                .address(customer.getAddress())
                .emailVerified(customer.isEmailVerified())
                .createdAt(customer.getCreatedAt())
                .updatedAt(customer.getUpdatedAt())
                .build();
    }
}
