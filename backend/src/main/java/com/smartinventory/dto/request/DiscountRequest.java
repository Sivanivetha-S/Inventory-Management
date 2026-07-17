package com.smartinventory.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class DiscountRequest {

    @NotBlank(message = "Discount name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;

    @NotNull(message = "Percentage is required")
    @DecimalMin(value = "0.01", message = "Percentage must be positive")
    @DecimalMax(value = "100.0", message = "Percentage cannot exceed 100")
    private BigDecimal percentage;

    // Minimum purchase amount — 0 means no minimum
    @DecimalMin(value = "0.0", message = "Minimum amount cannot be negative")
    private BigDecimal minimumPurchaseAmount = BigDecimal.ZERO;

    private String description;

    private boolean active = true;
}
