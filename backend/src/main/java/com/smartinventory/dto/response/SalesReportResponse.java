package com.smartinventory.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalesReportResponse {
    private LocalDate fromDate;
    private LocalDate toDate;
    private long totalInvoices;
    private BigDecimal totalRevenue;
    private BigDecimal totalDiscount;
    private List<InvoiceResponse> invoices;
}
