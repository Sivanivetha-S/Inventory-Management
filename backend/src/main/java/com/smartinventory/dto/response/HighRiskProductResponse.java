package com.smartinventory.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;

@Data
@Builder
public class HighRiskProductResponse {
    private String productName;
    private String barcode;
    private String branchName;
    private long theftCount;
    private int missingQuantity;
    private LocalDate lastDetectionDate;
    private String riskLevel;
}
