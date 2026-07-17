package com.smartinventory.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LossVerificationResponse {
    private Long productId;
    private String productName;
    private Integer expectedStock;
    private Integer actualStock;
    private Integer damagedQuantity;
    private Integer difference;           // expectedStock - actualStock
    private Integer unexplainedLoss;      // difference - damagedQuantity
    private BigDecimal unexplainedLossValue;
    private String status;                // NORMAL / POSSIBLE_LOSS
    private LocalDate verificationDate;
}
