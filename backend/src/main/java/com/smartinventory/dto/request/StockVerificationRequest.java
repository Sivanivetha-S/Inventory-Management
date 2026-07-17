package com.smartinventory.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class StockVerificationRequest {

    @NotEmpty(message = "Stock entries are required")
    private List<StockEntry> entries;

    @Data
    public static class StockEntry {

        @NotNull(message = "Product ID is required")
        private Long productId;

        @NotNull(message = "Actual stock is required")
        @Min(value = 0, message = "Actual stock cannot be negative")
        private Integer actualStock;

        private String adminNotes;
    }
}
