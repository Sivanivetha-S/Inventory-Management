package com.smartinventory.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class SupplierRegistrationRequest {

    @NotBlank(message = "Company name is required")
    private String companyName;

    @NotBlank(message = "Supplier name is required")
    private String supplierName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    @NotBlank(message = "Phone number is required")
    private String phoneNumber;

    private String address;

    /** Lat/Lng or city name detected on frontend via browser Geolocation API */
    private String location;
}
