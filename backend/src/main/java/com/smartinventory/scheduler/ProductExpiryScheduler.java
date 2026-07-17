package com.smartinventory.scheduler;

import com.smartinventory.document.Notification;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Product;
import com.smartinventory.entity.ProductBatch;
import com.smartinventory.entity.SupplierProduct;
import com.smartinventory.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ProductExpiryScheduler {

    private final ProductRepository productRepository;
    private final SupplierProductRepository supplierProductRepository;
    private final ProductBatchRepository productBatchRepository;
    private final MongoTemplate mongoTemplate;

    /**
     * Executes every day at 1:00 AM.
     * Evaluates expiration date mappings, transitions status, and sends AI-driven notifications.
     */
    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void checkProductExpirations() {
        log.info("Starting automated daily product expiry check...");
        LocalDate today = LocalDate.now();

        // ── 1. Check Owner/Admin Batches and Products ────────────────────────
        List<ProductBatch> activeBatches = productBatchRepository.findAll();
        for (ProductBatch batch : activeBatches) {
            Product product = batch.getProduct();
            if (product == null) continue;

            // Categories that do not verify expiry
            String category = product.getCategory() != null ? product.getCategory().trim().toLowerCase() : "";
            List<String> noDateCats = List.of(
                "dress", "clothing", "boxes", "plastic products", "stationery", "furniture",
                "dresses", "box", "plastic"
            );
            if (noDateCats.contains(category)) {
                continue; // Skip
            }

            LocalDate expDate = batch.getExpiryDate();
            if (expDate == null) continue;

            long daysToExpiry = ChronoUnit.DAYS.between(today, expDate);

            // Once Expiry Date is reached or passed
            if (!today.isBefore(expDate)) {
                if (!"Expired".equalsIgnoreCase(product.getStatus())) {
                    product.setStatus("Expired");
                    productRepository.save(product);

                    // Deactivate batch
                    batch.setActive(false);
                    productBatchRepository.save(batch);

                    // Generate AI Notification
                    String msg = "❌ Product '" + product.getName() + "' has expired today. Selling has been disabled. Recommendation: Remove expired stock from inventory.";
                    saveNotification(product.getAdmin().getId(), "LOW_STOCK", msg, "PRODUCT", product.getId());
                }
            } 
            // Expiring soon (Within next 5 days)
            else if (daysToExpiry >= 0 && daysToExpiry <= 5) {
                if (!"Expired".equalsIgnoreCase(product.getStatus()) && !"Expiring Soon".equalsIgnoreCase(product.getStatus())) {
                    product.setStatus("Expiring Soon");
                    productRepository.save(product);

                    String rec = getAIRecommendation(product.getName(), category, daysToExpiry);
                    String msg = "⚠️ Product '" + product.getName() + "' will expire in " + daysToExpiry + " days. " + rec;
                    saveNotification(product.getAdmin().getId(), "LOW_STOCK", msg, "PRODUCT", product.getId());
                }
            }
        }

        // ── 2. Check Supplier Products ───────────────────────────────────────
        List<SupplierProduct> supplierProducts = supplierProductRepository.findAll();
        for (SupplierProduct sp : supplierProducts) {
            String category = sp.getCategory() != null ? sp.getCategory().trim().toLowerCase() : "";
            List<String> noDateCats = List.of(
                "dress", "clothing", "boxes", "plastic products", "stationery", "furniture",
                "dresses", "box", "plastic"
            );
            if (noDateCats.contains(category)) {
                continue;
            }

            LocalDate expDate = sp.getExpiryDate();
            if (expDate == null) continue;

            long daysToExpiry = ChronoUnit.DAYS.between(today, expDate);

            if (!today.isBefore(expDate)) {
                if (!"Expired".equalsIgnoreCase(sp.getStatus())) {
                    sp.setStatus("Expired");
                    sp.setActive(false); // Hide from Owners
                    supplierProductRepository.save(sp);

                    // AI alert notification mapping for supplier
                    // For suppliers, let's store with a special negative ID or prefix, or let's create a notification with adminId as 0 (system level) or a mapped supplier reference.
                    // Since existing Notifications belong to adminId, we'll store supplier alerts by mapping adminId to -supplierId (negative ID) to isolate them cleanly!
                    String msg = "Your product '" + sp.getName() + "' has expired and has been automatically hidden from all Owners. Please update the batch or remove the expired stock.";
                    saveNotification(-sp.getSupplier().getId(), "SYSTEM", msg, "PRODUCT", sp.getId());
                }
            } else if (daysToExpiry >= 0 && daysToExpiry <= 5) {
                if (!"Expired".equalsIgnoreCase(sp.getStatus()) && !"Expiring Soon".equalsIgnoreCase(sp.getStatus())) {
                    sp.setStatus("Expiring Soon");
                    supplierProductRepository.save(sp);

                    String msg = "Your product '" + sp.getName() + "' will expire in " + daysToExpiry + " days. Recommendation: Replace with a new batch or apply discounts before expiry.";
                    saveNotification(-sp.getSupplier().getId(), "SYSTEM", msg, "PRODUCT", sp.getId());
                }
            }
        }
        log.info("Automated daily product expiry check completed successfully.");
    }

    private String getAIRecommendation(String name, String category, long days) {
        if (category.contains("medicine")) {
            return "Recommendation: Return the stock to the supplier or replace with a new batch.";
        } else if (category.contains("food") || category.contains("beverage") || category.contains("dairy") || category.contains("bakery")) {
            return "Recommendation: Apply discounts before expiry to clear stock quickly.";
        }
        return "Recommendation: Replace with a new batch or remove expired stock.";
    }

    private void saveNotification(Long targetId, String type, String message, String refType, Long refId) {
        Notification n = Notification.builder()
                .adminId(targetId) // Negative IDs represent Supplier targets
                .type(type)
                .message(message)
                .referenceType(refType)
                .referenceId(refId)
                .read(false)
                .createdAt(LocalDateTime.now())
                .build();
        mongoTemplate.save(n);
    }
}
