package com.smartinventory.document;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Notification stored in MongoDB — lightweight, append-only event log.
 * Types: STOCK_RECEIVED, THEFT_ALERT, SUPPLY_REQUEST, LOW_STOCK, SYSTEM
 */
@Document(collection = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id
    private String id;

    /** Admin (owner) this notification belongs to */
    @Indexed
    private Long adminId;

    private Long branchId;

    /** Notification category */
    private String type;           // STOCK_RECEIVED | THEFT_ALERT | SUPPLY_REQUEST | LOW_STOCK | SYSTEM

    private String message;

    /** Optional reference entity (PRODUCT, SUPPLY_REQUEST, THEFT_RECORD) */
    private String referenceType;

    private Long referenceId;

    @Builder.Default
    private boolean read = false;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
