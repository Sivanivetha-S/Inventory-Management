package com.smartinventory.dto.response;

import com.smartinventory.entity.SupplierProduct;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class SupplierProductResponse {

    // ── Identity ──────────────────────────────────────────────────────────────
    private Long id;
    private Long supplierId;
    private String supplierName;
    private String companyName;

    // ── Core product info ─────────────────────────────────────────────────────
    private String name;
    private String category;
    private String brand;
    private String unit;
    private String unitSize;
    private String description;
    private String barcodeNumber;

    // ── Image ─────────────────────────────────────────────────────────────────
    /** Relative URL path, e.g. /uploads/products/abc.jpg */
    private String productImage;

    // ── Dates ─────────────────────────────────────────────────────────────────
    private LocalDate manufacturingDate;
    private LocalDate expiryDate;

    // ── Pricing ───────────────────────────────────────────────────────────────
    private BigDecimal purchasePrice;
    private BigDecimal sellingPrice;
    /** Legacy field alias — equals sellingPrice */
    private BigDecimal unitPrice;

    // ── Stock ─────────────────────────────────────────────────────────────────
    private Integer quantity;
    /** Legacy alias — equals quantity */
    private Integer availableStock;
    private Integer minimumOrderQty;

    // ── Status ────────────────────────────────────────────────────────────────
    private boolean active;
    private String status;
    private LocalDateTime createdAt;

    // ── Mapper ───────────────────────────────────────────────────────────────
    public static SupplierProductResponse from(SupplierProduct sp) {
        // Effective selling price: prefer sellingPrice, fall back to unitPrice for legacy data
        BigDecimal selling = sp.getSellingPrice() != null ? sp.getSellingPrice() : sp.getUnitPrice();
        // Effective quantity: prefer quantity, fall back to availableStock for legacy data
        Integer qty = sp.getQuantity() != null ? sp.getQuantity() : sp.getAvailableStock();

        return SupplierProductResponse.builder()
                .id(sp.getId())
                .supplierId(sp.getSupplier().getId())
                .supplierName(sp.getSupplier().getSupplierName())
                .companyName(sp.getSupplier().getCompanyName())
                .name(sp.getName())
                .category(sp.getCategory())
                .brand(sp.getBrand())
                .unit(sp.getUnit())
                .unitSize(sp.getUnitSize())
                .description(sp.getDescription())
                .barcodeNumber(sp.getBarcodeNumber())
                .productImage(sp.getProductImage())
                .manufacturingDate(sp.getManufacturingDate())
                .expiryDate(sp.getExpiryDate())
                .purchasePrice(sp.getPurchasePrice())
                .sellingPrice(selling)
                .unitPrice(selling)              // legacy alias
                .quantity(qty)
                .availableStock(qty)             // legacy alias
                .minimumOrderQty(sp.getMinimumOrderQty())
                .active(sp.isActive())
                .status(sp.getStatus())
                .createdAt(sp.getCreatedAt())
                .build();
    }
}
