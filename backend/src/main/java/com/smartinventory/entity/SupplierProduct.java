package com.smartinventory.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * SupplierProduct — a product in the supplier's own catalog.
 * Separate from the owner's Product table.
 * Owners browse these to raise supply requests.
 */
@Entity
@Table(name = "supplier_products")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SupplierProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    private String brand;

    private String unit;  // e.g. kg, piece, litre

    @Column(name = "unit_size", length = 50)
    private String unitSize;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    /** Minimum order quantity */
    @Column(nullable = false)
    @Builder.Default
    private Integer minimumOrderQty = 1;

    /** Available stock the supplier has */
    @Column(nullable = false)
    @Builder.Default
    private Integer availableStock = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer totalStock = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer reservedStock = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer damagedStock = 0;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Builder.Default
    private String status = "Active"; // Active | Expiring Soon | Expired | Discontinued

    public String getStatus() {
        return status == null ? "Active" : status;
    }

    // ── Extended fields (added for image + date + price support) ──────────────

    /** Barcode number printed on the physical product */
    private String barcodeNumber;

    /** Relative path to uploaded image: uploads/products/filename.jpg */
    @Column(name = "product_image", length = 500)
    private String productImage;

    /** Manufacturing date (MFD) */
    @Column(name = "manufacturing_date")
    private LocalDate manufacturingDate;

    /** Expiry date — must be after manufacturingDate */
    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    /** Supplier's purchase/cost price */
    @Column(name = "purchase_price", precision = 10, scale = 2)
    private BigDecimal purchasePrice;

    /** Suggested selling price to the owner */
    @Column(name = "selling_price", precision = 10, scale = 2)
    private BigDecimal sellingPrice;

    /** Available quantity (replaces availableStock naming for clarity; kept in sync) */
    @Column(name = "quantity")
    private Integer quantity;

    @Column(updatable = false)
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate  protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
