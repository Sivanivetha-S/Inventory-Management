package com.smartinventory.service;

import com.smartinventory.entity.*;
import com.smartinventory.repository.*;
import com.smartinventory.email.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupplierTheftDetectionService {

    private final SupplierTheftRecordRepository supplierTheftRecordRepository;
    private final SupplierProductRepository supplierProductRepository;
    private final EmailService emailService;
    private final NotificationService notificationService;
    private final AuditLogRepository auditLogRepository;

    @Transactional
    public SupplierTheftRecord verifyStock(Long supplierProductId, Integer actualQuantity) {
        Supplier supplier = (Supplier) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        SupplierProduct sp = supplierProductRepository.findById(supplierProductId)
                .orElseThrow(() -> new RuntimeException("Supplier product not found"));

        if (!sp.getSupplier().getId().equals(supplier.getId())) {
            throw new RuntimeException("Access denied: Not your product");
        }

        int expected = sp.getAvailableStock();
        if (expected <= actualQuantity) {
            // No discrepancy or surplus, simply update stock to actual if necessary or do nothing.
            // Requirement specifies: "If Expected > Actual then Missing Quantity = Theft Quantity"
            return null;
        }

        int missing = expected - actualQuantity;

        // Decrement supplier product stock to match physical stock count
        sp.setAvailableStock(actualQuantity);
        sp.setTotalStock(sp.getAvailableStock() + sp.getReservedStock() + sp.getDamagedStock());
        supplierProductRepository.save(sp);

        SupplierTheftRecord record = SupplierTheftRecord.builder()
                .supplier(supplier)
                .supplierProduct(sp)
                .productName(sp.getName())
                .expectedQuantity(expected)
                .actualQuantity(actualQuantity)
                .missingQuantity(missing)
                .date(LocalDate.now())
                .build();

        SupplierTheftRecord saved = supplierTheftRecordRepository.save(record);

        // Audit Log
        AuditLog audit = AuditLog.builder()
                .userEmail(supplier.getEmail())
                .action("THEFT_DETECTION")
                .productName(sp.getName())
                .quantity(missing)
                .build();
        auditLogRepository.save(audit);

        // In-app Notification
        notificationService.createNotification(
                -supplier.getId(),
                "THEFT_DETECTED",
                "Theft alert: " + missing + " units missing for product " + sp.getName(),
                "THEFT",
                saved.getId()
        );

        // Send Email Alert to Supplier
        try {
            emailService.sendSupplierTheftAlertEmail(
                    supplier.getEmail(),
                    supplier.getSupplierName(),
                    sp.getName(),
                    expected,
                    actualQuantity,
                    missing
            );
        } catch (Exception e) {
            log.warn("Failed to send supplier theft alert email: {}", e.getMessage());
        }

        return saved;
    }

    public List<SupplierTheftRecord> getTheftRecords() {
        Supplier supplier = (Supplier) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return supplierTheftRecordRepository.findAllBySupplierOrderByDateDesc(supplier);
    }
}
