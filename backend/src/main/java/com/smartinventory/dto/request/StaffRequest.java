package com.smartinventory.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class StaffRequest {
    @NotBlank(message = "Full name is required")
    private String fullName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Username is required")
    private String username;

    private String password;

    @NotBlank(message = "Phone number is required")
    private String phoneNumber;

    private Boolean loginPermission;
    private Boolean billingPermission;
    private Long branchId;
}
