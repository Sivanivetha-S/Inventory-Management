package com.smartinventory.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ProductBatchRequest {

    /** Product Master ID — required when creating a batch for existing product */
    private Long productId;

    /**
     * Barcode scanned from manufacturer label.
     * If productId is null, system will look this up in Product table.
     * If not found, a new Product will be created using fields below.
     */
    private String barcode;

    // ── New Product fields (only needed if barcode not found in Product Master) ──
    private String productName;
    private String category;

    // ── Batch-specific fields (always required) ───────────────────────────────
    @NotBlank(message = "Batch number is required")
    private String batchNumber;

    private LocalDate manufacturingDate;
    private LocalDate expiryDate;

    @NotNull(message = "Purchase price is required")
    @DecimalMin(value = "0.01", message = "Purchase price must be positive")
    private BigDecimal purchasePrice;

    @NotNull(message = "Selling price is required")
    @DecimalMin(value = "0.01", message = "Selling price must be positive")
    private BigDecimal sellingPrice;

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    /** Optional: Staff ID who received this batch */
    private Long staffId;
}
