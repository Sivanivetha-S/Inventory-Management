package com.smartinventory.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "theft_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TheftRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id", nullable = false)
    private Admin admin;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String productName;

    @Column(nullable = false)
    private Integer openingStock;

    @Column(nullable = false)
    private Integer soldQuantity;

    @Column(nullable = false)
    private Integer expectedStock;

    @Column(nullable = false)
    private Integer actualStock;

    @Column(nullable = false)
    private Integer missingQuantity;  // total difference = expectedStock - actualStock

    // Recorded damage on this date — deducted before flagging as loss
    @Column(nullable = false)
    @Builder.Default
    private Integer damagedQuantity = 0;

    // The truly unexplained loss = missingQuantity - damagedQuantity
    @Column(nullable = false)
    @Builder.Default
    private Integer unexplainedLoss = 0;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal lossValue;

    @Column(nullable = false)
    private LocalDate detectionDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TheftStatus status = TheftStatus.DETECTED;

    @Column(length = 1000)
    private String adminNotes;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum TheftStatus {
        NORMAL,       // no unexplained loss
        DETECTED,     // unexplained loss found (formerly "theft detected")
        INVESTIGATED,
        RESOLVED
    }
}
