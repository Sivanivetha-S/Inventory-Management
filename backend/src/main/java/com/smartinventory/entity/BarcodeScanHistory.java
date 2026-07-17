package com.smartinventory.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "barcode_scan_history")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BarcodeScanHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String barcode;

    private String productName;

    private Long productId;

    @Column(nullable = false)
    private String userEmail;

    @Column(nullable = false)
    private String userRole;

    private Long branchId;

    private Long adminId;

    private String branchName;

    @Column(nullable = false)
    private String action; // BILLING, RECEIVING, VERIFICATION, SEARCH, CUSTOMER_RETURN, SUPPLIER_RETURN

    private String device;

    @Column(nullable = false)
    private LocalDateTime dateTime;

    @PrePersist
    protected void onCreate() {
        dateTime = LocalDateTime.now();
    }
}
