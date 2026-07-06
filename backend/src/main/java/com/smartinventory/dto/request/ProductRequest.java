package com.smartinventory.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ProductRequest {

    @NotBlank(message = "Product name is required")
    @Size(min = 2, max = 100, message = "Product name must be between 2 and 100 characters")
    private String name;

    @NotBlank(message = "Category is required")
    private String category;

    @NotNull(message = "Purchase price is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "Purchase price must be positive")
    private BigDecimal purchasePrice;

    @NotNull(message = "Selling price is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "Selling price must be positive")
    private BigDecimal sellingPrice;

    @NotNull(message = "Current stock is required")
    @Min(value = 0, message = "Stock cannot be negative")
    private Integer currentStock;

    @NotNull(message = "Minimum stock alert is required")
    @Min(value = 0, message = "Minimum stock alert cannot be negative")
    private Integer minimumStockAlert;
}
