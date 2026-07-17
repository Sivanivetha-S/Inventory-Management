package com.smartinventory.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SupplyRequestCreateRequest {

    /**
     * Required when OWNER creates request → the target supplier.
     * Required when SUPPLIER creates request → ignored (supplier is authenticated user).
     */
    private Long supplierId;

    /**
     * Required when SUPPLIER sends request to an owner → the target admin/shop.
     * Ignored when OWNER creates request.
     */
    private Long adminId;

    /** Optional — link to an existing owner product */
    private Long productId;

    /** Optional — target branch ID */
    private Long branchId;

    /** Optional — link to a supplier catalog product */
    private Long supplierProductId;

    @NotBlank(message = "Product name is required")
    private String productName;

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    private BigDecimal unitPrice;

    private String notes;

    private String unit;
    private String unitSize;

    /** OWNER_TO_SUPPLIER or SUPPLIER_TO_OWNER */
    private String direction = "OWNER_TO_SUPPLIER";
}
