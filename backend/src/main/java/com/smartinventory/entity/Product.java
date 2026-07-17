package com.smartinventory.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Owner inventory product. Null when this is a supplier catalog product.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id")
    private Admin admin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    private Branch branch;

    // Supplier catalog product. Null when this is an owner inventory product.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    /** Manufacturer barcode — stored on first scan. Nullable for older products. */
    @Column(unique = false)
    private String barcode;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal purchasePrice;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal sellingPrice;

    @Column(nullable = false)
    @Builder.Default
    private Integer currentStock = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer minimumStockAlert = 5;

    @Column(nullable = false)
    @Builder.Default
    private Integer openingStock = 0;

    @Builder.Default
    private String status = "Active"; // Active | Expiring Soon | Expired | Discontinued

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private RiskLevel riskLevel = RiskLevel.LOW;

    public enum RiskLevel { LOW, MEDIUM, HIGH }

    public String getStatus() {
        return status == null ? "Active" : status;
    }

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (openingStock == 0 && currentStock > 0) {
            openingStock = currentStock;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public boolean isLowStock() {
        return currentStock <= minimumStockAlert;
    }
}
