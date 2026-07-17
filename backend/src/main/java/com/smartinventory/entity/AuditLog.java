package com.smartinventory.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime dateTime;

    @Column(nullable = false)
    private String userEmail;

    @Column(nullable = false)
    private String action; // e.g. DISPATCH, ACCEPT, REJECT, THEFT_DETECTION, STOCK_UPDATE

    @Column(nullable = false)
    private String productName;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(name = "branch_id")
    private Long branchId;

    @Column(name = "product_id")
    private Long productId;

    @PrePersist protected void onCreate() { dateTime = LocalDateTime.now(); }
}
