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
    private final StaffRepository staffRepository;
    private final AdminRepository adminRepository;
    private final ProductService productService;
    private final InvoiceService invoiceService;
    private final TheftDetectionService theftDetectionService;
    private final SecurityUtils securityUtils;
    private final BranchRepository branchRepository;

    public ApiResponse<DashboardResponse> getDashboardData() {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<com.smartinventory.entity.Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        LocalDate today = LocalDate.now();
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime todayEnd = today.atTime(LocalTime.MAX);

        List<com.smartinventory.entity.Product> products = productRepository.findByAdminIdAndBranchId(adminId, branchId);
        List<com.smartinventory.entity.Customer> customers = branchId == null
                ? customerRepository.findByAdminId(adminId)
                : customerRepository.findByAdminIdAndBranchId(adminId, branchId);
        List<com.smartinventory.entity.Invoice> invoices = invoiceRepository.findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(adminId, branchId);
        List<com.smartinventory.entity.TheftRecord> theftRecords = theftRecordRepository.findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(adminId, branchId);

        if (branchId != null) {
            customers = customers.stream()
                    .filter(c -> c.getBranches() == null || c.getBranches().isEmpty() || c.getBranches().stream().anyMatch(b -> b.getId().equals(branchId)))
                    .collect(Collectors.toList());
        }

        long totalProducts  = products.size();
        long totalCustomers = customers.size();
        long totalSales     = invoices.size();

        BigDecimal todayRevenue = invoices.stream()
                .filter(i -> i.getCreatedAt().isAfter(todayStart) && i.getCreatedAt().isBefore(todayEnd) && i.getStatus() == com.smartinventory.entity.Invoice.InvoiceStatus.PAID)
                .map(com.smartinventory.entity.Invoice::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRevenue = invoices.stream()
                .filter(i -> i.getStatus() == com.smartinventory.entity.Invoice.InvoiceStatus.PAID)
                .map(com.smartinventory.entity.Invoice::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long lowStockCount = products.stream().filter(com.smartinventory.entity.Product::isLowStock).count();
        long theftCount = theftRecords.stream().filter(t -> t.getStatus() == com.smartinventory.entity.TheftRecord.TheftStatus.DETECTED).count();

        List<ProductResponse> lowStockProducts = products.stream()
                .filter(com.smartinventory.entity.Product::isLowStock)
                .limit(5).map(productService::mapToResponse).collect(Collectors.toList());

        List<InvoiceResponse> recentBills = invoices.stream()
                .limit(5).map(invoiceService::mapToResponse).collect(Collectors.toList());

        List<TheftRecordResponse> recentThefts = theftRecords.stream()
                .limit(5).map(theftDetectionService::mapToResponse).collect(Collectors.toList());
        List<HighRiskProductResponse> highRiskProducts = products.stream()
                .filter(product -> product.getRiskLevel() == com.smartinventory.entity.Product.RiskLevel.HIGH)
                .map(product -> {
                    List<com.smartinventory.entity.TheftRecord> history = theftRecords.stream()
                            .filter(record -> record.getProduct() != null && record.getProduct().getId().equals(product.getId()))
                            .filter(record -> record.getUnexplainedLoss() != null && record.getUnexplainedLoss() > 0).toList();
                    return HighRiskProductResponse.builder().productName(product.getName()).barcode(product.getBarcode())
                            .branchName(product.getBranch() == null ? "" : product.getBranch().getName()).theftCount(history.size())
                            .missingQuantity(history.stream().mapToInt(record -> record.getUnexplainedLoss()).sum())
                            .lastDetectionDate(history.stream().map(com.smartinventory.entity.TheftRecord::getDetectionDate).max(LocalDate::compareTo).orElse(null))
                            .riskLevel("HIGH").build();
                }).sorted(Comparator.comparingLong(HighRiskProductResponse::getTheftCount).reversed()).collect(Collectors.toList());

        // Weekly sales (last 7 days)
        Map<String, BigDecimal> weeklySales = new LinkedHashMap<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            LocalDateTime dStart = day.atStartOfDay();
            LocalDateTime dEnd = day.atTime(LocalTime.MAX);
            BigDecimal rev = invoices.stream()
                    .filter(inv -> inv.getCreatedAt().isAfter(dStart) && inv.getCreatedAt().isBefore(dEnd) && inv.getStatus() == com.smartinventory.entity.Invoice.InvoiceStatus.PAID)
                    .map(com.smartinventory.entity.Invoice::getTotalAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            weeklySales.put(day.format(DateTimeFormatter.ofPattern("EEE")), rev);
        }

        // Monthly sales (last 6 months)
        Map<String, BigDecimal> monthlySales = new LinkedHashMap<>();
        for (int i = 5; i >= 0; i--) {
            LocalDate month = today.minusMonths(i);
            LocalDateTime mStart = month.withDayOfMonth(1).atStartOfDay();
            LocalDateTime mEnd = month.withDayOfMonth(month.lengthOfMonth()).atTime(LocalTime.MAX);
            BigDecimal rev = invoices.stream()
                    .filter(inv -> inv.getCreatedAt().isAfter(mStart) && inv.getCreatedAt().isBefore(mEnd) && inv.getStatus() == com.smartinventory.entity.Invoice.InvoiceStatus.PAID)
                    .map(com.smartinventory.entity.Invoice::getTotalAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            monthlySales.put(month.format(DateTimeFormatter.ofPattern("MMM")), rev);
        }

        com.smartinventory.entity.Admin admin = adminRepository.findById(adminId).orElse(null);
        List<StaffStatsResponse> staffStats = new ArrayList<>();
        if (admin != null) {
            List<com.smartinventory.entity.Staff> staffList = staffRepository.findAllByAdmin(admin);
            if (branchId != null) {
                staffList = staffList.stream()
                        .filter(s -> s.getBranch() != null && s.getBranch().getId().equals(branchId))
                        .collect(Collectors.toList());
            }
            for (com.smartinventory.entity.Staff s : staffList) {
                final Long sId = s.getId();
                long count = invoices.stream()
                        .filter(inv -> inv.getStaff() != null && inv.getStaff().getId().equals(sId))
                        .count();
                BigDecimal rev = invoices.stream()
                        .filter(inv -> inv.getStaff() != null && inv.getStaff().getId().equals(sId) && inv.getStatus() == com.smartinventory.entity.Invoice.InvoiceStatus.PAID)
                        .map(com.smartinventory.entity.Invoice::getTotalAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                staffStats.add(StaffStatsResponse.builder()
                        .name(s.getFullName())
                        .billsCreated(count)
                        .revenue(rev)
                        .build());
            }
        }

        return ApiResponse.success("Dashboard data retrieved", DashboardResponse.builder()
                .totalProducts(totalProducts)
                .totalCustomers(totalCustomers)
                .totalSales(totalSales)
                .todayRevenue(todayRevenue)
                .totalRevenue(totalRevenue)
                .lowStockCount(lowStockCount)
                .theftAlertsCount(theftCount)
                .lowStockProducts(lowStockProducts)
                .recentBills(recentBills)
                .recentTheftAlerts(recentThefts)
                .highRiskProducts(highRiskProducts)
                .weeklySales(weeklySales)
                .monthlySales(monthlySales)
                .staffStats(staffStats)
                .build());
    }
}
