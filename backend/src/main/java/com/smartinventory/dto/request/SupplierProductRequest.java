package com.smartinventory.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * SupplierProductRequest — sent as a JSON string inside a multipart request.
 * The image file is uploaded as a separate "image" part.
 */
@Data
public class SupplierProductRequest {

    @NotBlank(message = "Product name is required")
    private String name;

    @NotBlank(message = "Category is required")
    private String category;

    private String brand;

    private String unit;

    @Size(max = 500)
    private String description;

    // ── Price ─────────────────────────────────────────────────────────────────

    @NotNull(message = "Purchase price is required")
    @DecimalMin(value = "0.01", message = "Purchase price must be positive")
    private BigDecimal purchasePrice;

    @NotNull(message = "Selling price is required")
    @DecimalMin(value = "0.01", message = "Selling price must be positive")
    private BigDecimal sellingPrice;

    /** Legacy field: kept for backward-compat; maps to sellingPrice if unitPrice absent */
    private BigDecimal unitPrice;

    // ── Stock ─────────────────────────────────────────────────────────────────

    @Min(value = 0, message = "Quantity cannot be negative")
    private Integer quantity = 0;

    @Min(value = 50, message = "Minimum Order Quantity must be 50 or above.")
    private Integer minimumOrderQty = 50;

    /** Legacy: availableStock — kept for backward-compat */
    @Min(value = 0)
    private Integer availableStock = 0;

    // ── Product details ───────────────────────────────────────────────────────

    private String barcodeNumber;

    private LocalDate manufacturingDate;

    private LocalDate expiryDate;

    private String unitSize;
}
