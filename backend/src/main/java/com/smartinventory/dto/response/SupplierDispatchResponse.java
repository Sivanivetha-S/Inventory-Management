package com.smartinventory.dto.response;

import com.smartinventory.entity.SupplierDispatch;
import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SupplierDispatchResponse {
    private Long id;
    private Long supplierId;
    private String supplierCompanyName;
    private String supplierName;
    private Long adminId;
    private String adminShopName;
    private String adminName;
    private Long branchId;
    private String branchName;
    private Long supplierProductId;
    private String productName;
    private Integer quantity;
    private LocalDateTime dispatchDate;
    private String status;
    private String rejectionReason;
    private LocalDateTime rejectionDate;

    public static SupplierDispatchResponse from(SupplierDispatch entity) {
        if (entity == null) return null;
        return SupplierDispatchResponse.builder()
                .id(entity.getId())
                .supplierId(entity.getSupplier() != null ? entity.getSupplier().getId() : null)
                .supplierCompanyName(entity.getSupplier() != null ? entity.getSupplier().getCompanyName() : null)
                .supplierName(entity.getSupplier() != null ? entity.getSupplier().getSupplierName() : null)
                .adminId(entity.getAdmin() != null ? entity.getAdmin().getId() : null)
                .adminShopName(entity.getAdmin() != null ? entity.getAdmin().getShopName() : null)
                .adminName(entity.getAdmin() != null ? entity.getAdmin().getFullName() : null)
                .branchId(entity.getBranch() != null ? entity.getBranch().getId() : null)
                .branchName(entity.getBranch() != null ? entity.getBranch().getName() : null)
                .supplierProductId(entity.getSupplierProduct() != null ? entity.getSupplierProduct().getId() : null)
                .productName(entity.getSupplierProduct() != null ? entity.getSupplierProduct().getName() : null)
                .quantity(entity.getQuantity())
                .dispatchDate(entity.getDispatchDate())
                .status(entity.getStatus())
                .rejectionReason(entity.getRejectionReason())
                .rejectionDate(entity.getRejectionDate())
                .build();
    }
}
