package com.smartinventory.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * SupplyRequest — captures the Owner↔Supplier supply workflow.
 * Direction OWNER_TO_SUPPLIER: owner requests products from supplier.
 * Direction SUPPLIER_TO_OWNER: supplier offers products to owner.
 */
@Entity
@Table(name = "supply_requests")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SupplyRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The shop owner */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id", nullable = false)
    private Admin admin;

    /** The target branch */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    private Branch branch;

    /** The supplier */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    /** Which product is being requested/offered (Owner's catalog product) */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id")
    private Product product;

    /** The supplier catalog product */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "supplier_product_id")
    private SupplierProduct supplierProduct;

    /** Product name snapshot — preserved even if product changes */
    @Column(nullable = false)
    private String productName;

    @Column(nullable = false)
    private Integer quantity;

    /** Agreed unit price (set when accepted) */
    @Column(precision = 10, scale = 2)
    private BigDecimal unitPrice;

    /** Who initiated the request */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RequestDirection direction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private RequestStatus status = RequestStatus.PENDING;

    private String notes;

    @Column(name = "unit", length = 50)
    private String unit;

    @Column(name = "unit_size", length = 50)
    private String unitSize;

    @Column(updatable = false)
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime respondedAt;

    @PrePersist protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate  protected void onUpdate() { updatedAt = LocalDateTime.now(); }

    public enum RequestDirection {
        OWNER_TO_SUPPLIER,   // owner requests products from supplier
        SUPPLIER_TO_OWNER    // supplier offers/pushes products to owner
    }

    public enum RequestStatus {
        PENDING, ACCEPTED, REJECTED, DISPATCHED, RECEIVED, CANCELLED
    }
}
