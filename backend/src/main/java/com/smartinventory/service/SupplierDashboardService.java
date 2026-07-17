package com.smartinventory.service;

import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.SupplierDashboardResponse;
import com.smartinventory.entity.*;
import com.smartinventory.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SupplierDashboardService {

    private final SupplierProductRepository supplierProductRepository;
    private final SupplierDispatchRepository supplierDispatchRepository;
    private final SupplierTheftRecordRepository supplierTheftRecordRepository;
    private final SupplierRepository supplierRepository;
    private final SupplyRequestRepository supplyRequestRepository;

    public ApiResponse<SupplierDashboardResponse> getDashboardData() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Supplier supplier = supplierRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Supplier not found"));

        List<SupplierProduct> products = supplierProductRepository.findAllBySupplierOrderByCreatedAtDesc(supplier);
        long totalProducts = products.size();
        long totalStock = products.stream().mapToLong(p -> p.getAvailableStock() != null ? p.getAvailableStock() : 0).sum();

        List<SupplierDispatch> dispatches = supplierDispatchRepository.findAllBySupplierOrderByDispatchDateDesc(supplier);

        LocalDate today = LocalDate.now();

        long todayDispatches = dispatches.stream()
                .filter(d -> d.getDispatchDate() != null && d.getDispatchDate().toLocalDate().equals(today))
                .count();

        // Use SupplyRequest records for accurate pending/accepted/rejected counts
        List<SupplyRequest> supplyRequests = supplyRequestRepository.findAllBySupplierOrderByCreatedAtDesc(supplier);
        long pendingRequests = supplyRequests.stream()
                .filter(r -> SupplyRequest.RequestStatus.PENDING.equals(r.getStatus())).count();
        long acceptedRequests = supplyRequests.stream()
                .filter(r -> SupplyRequest.RequestStatus.ACCEPTED.equals(r.getStatus())).count();
        long rejectedRequests = supplyRequests.stream()
                .filter(r -> SupplyRequest.RequestStatus.REJECTED.equals(r.getStatus())).count();

        List<SupplierProduct> lowStock = products.stream()
                .filter(p -> p.getAvailableStock() != null && p.getAvailableStock() < 10)
                .collect(Collectors.toList());

        List<SupplierTheftRecord> theftAlerts = supplierTheftRecordRepository.findAllBySupplierOrderByDateDesc(supplier);

        SupplierDashboardResponse data = SupplierDashboardResponse.builder()
                .totalProducts(totalProducts)
                .totalStock(totalStock)
                .todayDispatches(todayDispatches)
                .pendingRequests(pendingRequests)
                .acceptedRequests(acceptedRequests)
                .rejectedRequests(rejectedRequests)
                .lowStockProducts(lowStock)
                .theftAlerts(theftAlerts)
                .build();

        return ApiResponse.success("Supplier Dashboard data retrieved", data);
    }
}
