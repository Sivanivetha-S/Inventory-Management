package com.smartinventory.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TheftRecordResponse {
    private Long id;
    private Long productId;
    private String productName;
    private Integer openingStock;
    private Integer soldQuantity;
    private Integer expectedStock;
    private Integer actualStock;
    private Integer missingQuantity;
    private Integer damagedQuantity;
    private Integer unexplainedLoss;
    private BigDecimal lossValue;
    private LocalDate detectionDate;
    private String status;
    private String adminNotes;
    private LocalDateTime createdAt;
}
