package com.smartinventory.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * ProductBatch — one record per stock receipt.
 * Multiple batches can reference the same Product (Product Master).
 * Stock is consumed FIFO by earliest expiry / earliest received date.
 */
@Entity
@Table(name = "product_batches")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Link to the Product Master record */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** The admin (shop owner) this batch belongs to */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id", nullable = false)
    private Admin admin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    private Branch branch;

    /** Staff who received this batch (nullable — owner can also add) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id")
    private Staff receivedByStaff;

    @Column(nullable = false)
    private String batchNumber;

    /** Manufacturer barcode — same as Product.barcode */
    private String barcode;

    private LocalDate manufacturingDate;

    private LocalDate expiryDate;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal purchasePrice;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal sellingPrice;

    /** Quantity received in this batch */
    @Column(nullable = false)
    private Integer quantityReceived;

    /** Quantity still available (starts = quantityReceived, decreases on sale) */
    @Column(nullable = false)
    @Builder.Default
    private Integer quantityRemaining = 0;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(updatable = false)
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist protected void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
        if (quantityRemaining == 0 && quantityReceived != null) {
            quantityRemaining = quantityReceived;
        }
    }
    @PreUpdate  protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
