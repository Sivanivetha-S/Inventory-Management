package com.smartinventory.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "product_returns")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductReturn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long adminId;

    private Long branchId;

    @Column(nullable = false)
    private String barcode;

    @Column(nullable = false)
    private String productName;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private String returnType; // CUSTOMER_TO_OWNER, OWNER_TO_SUPPLIER

    private Long supplierId;

    @Builder.Default
    @Column(nullable = false)
    private String status = "PENDING"; // PENDING, ACCEPTED, REJECTED

    private String rejectionReason;

    @Column(length = 2000)
    private String evidenceUrls;

    private String customerDecision; // REFUND, EXCHANGE

    private java.math.BigDecimal refundAmount;

    private String refundMethod; // CASH, UPI, BANK_TRANSFER

    private LocalDateTime refundDate;

    private Long exchangedProductId;

    private Integer exchangedProductQuantity;

    private Long exchangeNewInvoiceId;

    private String exchangeNewInvoiceNumber;

    private String processedBy;

    @Column(name = "`condition`")
    private String condition; // GOOD, DAMAGED

    private String invoiceNumber; // nullable for supplier returns

    private String notes;

    @Column(name = "ai_confidence_score", precision = 5, scale = 2)
    private java.math.BigDecimal aiConfidenceScore;

    @Column(name = "ai_validation_status", length = 50)
    private String aiValidationStatus;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = "PENDING";
        }
    }
}
