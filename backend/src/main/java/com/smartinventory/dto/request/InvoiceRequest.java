package com.smartinventory.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class InvoiceRequest {

    private Long customerId;

    @NotEmpty(message = "Invoice must have at least one item")
    private List<InvoiceItemRequest> items;

    @DecimalMin(value = "0.0", message = "Discount cannot be negative")
    @DecimalMax(value = "100.0", message = "Discount cannot exceed 100%")
    private BigDecimal discountPercentage = BigDecimal.ZERO;

    private String notes;

    private String paymentMethod;

    @Data
    public static class InvoiceItemRequest {

        @NotNull(message = "Product ID is required")
        private Long productId;

        @NotNull(message = "Quantity is required")
        @Min(value = 1, message = "Quantity must be at least 1")
        private Integer quantity;
    }
}
