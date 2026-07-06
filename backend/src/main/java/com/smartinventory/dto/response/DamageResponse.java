package com.smartinventory.dto.response;

import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DamageResponse {
    private Long id;
    private Long productId;
    private String productName;
    private Integer quantity;
    private String reason;
    private String notes;
    private LocalDate damageDate;
    private LocalDateTime createdAt;
}
