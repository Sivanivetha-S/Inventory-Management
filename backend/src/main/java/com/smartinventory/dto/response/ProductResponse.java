package com.smartinventory.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductResponse {
    private Long id;
    private Long adminId;
    private String shopName;
    private Long supplierId;
    private String supplierName;
    private String companyName;
    private String ownerType;
    private String name;
    private String category;
    private String barcode;
    private String riskLevel;
    private BigDecimal purchasePrice;
    private BigDecimal sellingPrice;
    private Integer currentStock;
    private Integer minimumStockAlert;
    private Integer openingStock;
    private boolean lowStock;
    private String status;
    private Long branchId;
    private String branchName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
