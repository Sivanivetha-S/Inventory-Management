package com.smartinventory.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "damage_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DamageRecord {

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
    private Integer quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DamageReason reason;

    @Column(length = 500)
    private String notes;

    @Column(nullable = false)
    private LocalDate damageDate;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (damageDate == null) damageDate = LocalDate.now();
    }

    public enum DamageReason {
        BROKEN, EXPIRED, DEFECTIVE, OTHER
    }
}
