package com.smartinventory.service;

import com.smartinventory.entity.AuditLog;
import com.smartinventory.entity.Product;
import com.smartinventory.entity.TheftRecord;
import com.smartinventory.repository.AuditLogRepository;
import com.smartinventory.repository.ProductRepository;
import com.smartinventory.repository.TheftRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TheftRiskService {
    private static final int ALERT_THRESHOLD = 3;
    private static final int MISSING_QUANTITY_THRESHOLD = 10;
    private final TheftRecordRepository theftRecordRepository;
    private final ProductRepository productRepository;
    private final AuditLogRepository auditLogRepository;
    private final NotificationService notificationService;

    @Transactional
    public void evaluateAfterPossibleLoss(TheftRecord record) {
        if (record.getUnexplainedLoss() == null || record.getUnexplainedLoss() <= 0) return;
        Product product = record.getProduct();
        List<TheftRecord> recent = theftRecordRepository.findByAdminIdAndBranchIdAndProductId(
                record.getAdmin().getId(), record.getBranch().getId(), product.getId()).stream()
                .filter(item -> !item.getDetectionDate().isBefore(LocalDate.now().minusDays(30)))
                .filter(item -> item.getUnexplainedLoss() != null && item.getUnexplainedLoss() > 0).toList();
        int theftCount = recent.size();
        int missing = recent.stream().mapToInt(item -> item.getUnexplainedLoss()).sum();
        Product.RiskLevel next = (theftCount > ALERT_THRESHOLD || missing > MISSING_QUANTITY_THRESHOLD)
                ? Product.RiskLevel.HIGH : theftCount > 1 ? Product.RiskLevel.MEDIUM : Product.RiskLevel.LOW;
        updateRisk(product, next, "30-day theft alerts: " + theftCount + "; missing quantity: " + missing, record, theftCount, missing);
    }

    @Scheduled(cron = "0 10 0 * * *")
    @Transactional
    public void downgradeInactiveRisks() {
        for (Product product : productRepository.findAll()) {
            if (product.getAdmin() == null || product.getBranch() == null || product.getRiskLevel() == Product.RiskLevel.LOW) continue;
            List<TheftRecord> history = theftRecordRepository.findByAdminIdAndBranchIdAndProductId(product.getAdmin().getId(), product.getBranch().getId(), product.getId());
            boolean inactive = history.stream().noneMatch(record -> !record.getDetectionDate().isBefore(LocalDate.now().minusDays(60)));
            if (inactive) updateRisk(product, product.getRiskLevel() == Product.RiskLevel.HIGH ? Product.RiskLevel.MEDIUM : Product.RiskLevel.LOW,
                    "No theft alert recorded for 60 consecutive days", null, 0, 0);
        }
    }

    private void updateRisk(Product product, Product.RiskLevel next, String reason, TheftRecord record, int theftCount, int missing) {
        Product.RiskLevel previous = product.getRiskLevel() == null ? Product.RiskLevel.LOW : product.getRiskLevel();
        if (previous == next) return;
        product.setRiskLevel(next);
        productRepository.save(product);
        auditLogRepository.save(AuditLog.builder().userEmail("System").action("THEFT_RISK_LEVEL_CHANGED")
                .productName(product.getName()).quantity(missing).ownerId(product.getAdmin().getId())
                .branchId(product.getBranch().getId()).productId(product.getId())
                .build());
        if (next == Product.RiskLevel.HIGH && record != null) {
            String message = "🚨🚨 HIGH RISK THEFT ALERT\n\nProduct: " + product.getName()
                    + "\nBranch: " + product.getBranch().getName() + "\nBarcode: " + product.getBarcode()
                    + "\n\nThis product has generated multiple theft alerts.\nTheft Count: " + theftCount
                    + "\nTotal Missing Quantity: " + missing + "\nRisk Level: HIGH\n\nImmediate investigation is recommended.";
            notificationService.createNotification(product.getAdmin().getId(), product.getBranch().getId(), "HIGH_RISK_THEFT_ALERT", message, "THEFT_RECORD", record.getId());
        }
    }
}
