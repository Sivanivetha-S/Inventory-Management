package com.smartinventory.dto.response;

import com.smartinventory.entity.SupplyRequest;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class SupplyRequestResponse {
    private Long id;
    private Long adminId;
    private String adminName;
    private String adminShopName;
    private Long supplierId;
    private String supplierName;
    private String companyName;
    private Long productId;
    private Long supplierProductId;
    private String productName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private String direction;
    private String status;
    private String notes;
    private String unit;
    private String unitSize;
    private Long branchId;
    private String branchName;
    private LocalDateTime createdAt;
    private LocalDateTime respondedAt;

    public static SupplyRequestResponse from(SupplyRequest r) {
        return SupplyRequestResponse.builder()
                .id(r.getId())
                .adminId(r.getAdmin().getId())
                .adminName(r.getAdmin().getFullName())
                .adminShopName(r.getAdmin().getShopName() != null
                        ? r.getAdmin().getShopName() : r.getAdmin().getFullName())
                .supplierId(r.getSupplier().getId())
                .supplierName(r.getSupplier().getSupplierName())
                .companyName(r.getSupplier().getCompanyName())
                .productId(r.getProduct() != null ? r.getProduct().getId() : null)
                .supplierProductId(r.getSupplierProduct() != null ? r.getSupplierProduct().getId() : null)
                .productName(r.getProductName())
                .quantity(r.getQuantity())
                .unitPrice(r.getUnitPrice())
                .direction(r.getDirection().name())
                .status(r.getStatus().name())
                .notes(r.getNotes())
                .unit(r.getUnit())
                .unitSize(r.getUnitSize())
                .branchId(r.getBranch() != null ? r.getBranch().getId() : null)
                .branchName(r.getBranch() != null ? r.getBranch().getName() : null)
                .createdAt(r.getCreatedAt())
                .respondedAt(r.getRespondedAt())
                .build();
    }
}
