package com.smartinventory.service;

import com.smartinventory.dto.response.*;
import com.smartinventory.entity.TheftRecord;
import com.smartinventory.repository.*;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;
    private final TheftRecordRepository theftRecordRepository;
    private final ProductService productService;
    private final InvoiceService invoiceService;
    private final TheftDetectionService theftDetectionService;
    private final SecurityUtils securityUtils;

    public ApiResponse<DashboardResponse> getDashboardData() {
        Long adminId = securityUtils.getCurrentAdminId();
        LocalDate today = LocalDate.now();
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime todayEnd = today.atTime(LocalTime.MAX);

        long totalProducts  = productRepository.findByAdminId(adminId).size();
        long totalCustomers = customerRepository.findByAdminId(adminId).size();
        long totalSales     = invoiceRepository.countByAdminId(adminId);
        BigDecimal todayRevenue = invoiceRepository.sumRevenueByAdminIdAndDateRange(adminId, todayStart, todayEnd);
        BigDecimal totalRevenue = invoiceRepository.sumTotalRevenueByAdminId(adminId);
        long lowStockCount  = productRepository.countLowStockByAdminId(adminId);
        long theftCount     = theftRecordRepository.countByAdminIdAndStatus(adminId, TheftRecord.TheftStatus.DETECTED);

        List<ProductResponse> lowStockProducts = productRepository.findLowStockByAdminId(adminId)
                .stream().limit(5).map(productService::mapToResponse).collect(Collectors.toList());

        List<InvoiceResponse> recentBills = invoiceRepository.findAllByAdminIdOrderByCreatedAtDesc(adminId)
                .stream().limit(5).map(invoiceService::mapToResponse).collect(Collectors.toList());

        List<TheftRecordResponse> recentThefts = theftRecordRepository.findAllByAdminIdOrderByCreatedAtDesc(adminId)
                .stream().limit(5).map(theftDetectionService::mapToResponse).collect(Collectors.toList());

        // Weekly sales (last 7 days)
        Map<String, BigDecimal> weeklySales = new LinkedHashMap<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            BigDecimal rev = invoiceRepository.sumRevenueByAdminIdAndDateRange(
                    adminId, day.atStartOfDay(), day.atTime(LocalTime.MAX));
            weeklySales.put(day.format(DateTimeFormatter.ofPattern("EEE")),
                    rev != null ? rev : BigDecimal.ZERO);
        }

        // Monthly sales (last 6 months)
        Map<String, BigDecimal> monthlySales = new LinkedHashMap<>();
        for (int i = 5; i >= 0; i--) {
            LocalDate month = today.minusMonths(i);
            LocalDate start = month.withDayOfMonth(1);
            LocalDate end   = month.withDayOfMonth(month.lengthOfMonth());
            BigDecimal rev  = invoiceRepository.sumRevenueByAdminIdAndDateRange(
                    adminId, start.atStartOfDay(), end.atTime(LocalTime.MAX));
            monthlySales.put(month.format(DateTimeFormatter.ofPattern("MMM")),
                    rev != null ? rev : BigDecimal.ZERO);
        }

        return ApiResponse.success("Dashboard data retrieved", DashboardResponse.builder()
                .totalProducts(totalProducts)
                .totalCustomers(totalCustomers)
                .totalSales(totalSales)
                .todayRevenue(todayRevenue != null ? todayRevenue : BigDecimal.ZERO)
                .totalRevenue(totalRevenue != null ? totalRevenue : BigDecimal.ZERO)
                .lowStockCount(lowStockCount)
                .theftAlertsCount(theftCount)
                .lowStockProducts(lowStockProducts)
                .recentBills(recentBills)
                .recentTheftAlerts(recentThefts)
                .weeklySales(weeklySales)
                .monthlySales(monthlySales)
                .build());
    }
}
