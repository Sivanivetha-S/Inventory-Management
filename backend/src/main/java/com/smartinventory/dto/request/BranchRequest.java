package com.smartinventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BranchRequest {
    @NotBlank(message = "Branch name is required")
    private String name;

    @NotBlank(message = "Branch address is required")
    private String address;

    @NotBlank(message = "City is required")
    private String city;

    @NotBlank(message = "State is required")
    private String state;

    @NotBlank(message = "Pincode is required")
    private String pincode;

    @NotBlank(message = "Contact number is required")
    private String contactNumber;

    private Boolean active;
}
