package com.smartinventory.dto.response;

import com.smartinventory.entity.ProductBatch;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class ProductBatchResponse {
    private Long id;
    private Long productId;
    private String productName;
    private String barcode;
    private String category;
    private String batchNumber;
    private LocalDate manufacturingDate;
    private LocalDate expiryDate;
    private BigDecimal purchasePrice;
    private BigDecimal sellingPrice;
    private Integer quantityReceived;
    private Integer quantityRemaining;
    private boolean active;
    private String receivedByStaffName;
    private LocalDateTime createdAt;

    public static ProductBatchResponse from(ProductBatch b) {
        return ProductBatchResponse.builder()
                .id(b.getId())
                .productId(b.getProduct().getId())
                .productName(b.getProduct().getName())
                .barcode(b.getBarcode())
                .category(b.getProduct().getCategory())
                .batchNumber(b.getBatchNumber())
                .manufacturingDate(b.getManufacturingDate())
                .expiryDate(b.getExpiryDate())
                .purchasePrice(b.getPurchasePrice())
                .sellingPrice(b.getSellingPrice())
                .quantityReceived(b.getQuantityReceived())
                .quantityRemaining(b.getQuantityRemaining())
                .active(b.isActive())
                .receivedByStaffName(b.getReceivedByStaff() != null
                        ? b.getReceivedByStaff().getFullName() : null)
                .createdAt(b.getCreatedAt())
                .build();
    }
}
