package com.smartinventory.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardResponse {
    private long totalProducts;
    private long totalCustomers;
    private long totalSales;
    private BigDecimal todayRevenue;
    private BigDecimal totalRevenue;
    private long lowStockCount;
    private long theftAlertsCount;
    private List<ProductResponse> lowStockProducts;
    private List<InvoiceResponse> recentBills;
    private List<TheftRecordResponse> recentTheftAlerts;
    private Map<String, BigDecimal> weeklySales;
    private Map<String, BigDecimal> monthlySales;
    private Map<String, Long> salesByCategory;
}
