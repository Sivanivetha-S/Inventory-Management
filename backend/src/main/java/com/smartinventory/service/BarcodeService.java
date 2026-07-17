package com.smartinventory.service;

import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.entity.*;
import com.smartinventory.repository.*;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class BarcodeService {

    private final ProductRepository productRepository;
    private final ProductBatchRepository productBatchRepository;
    private final BarcodeScanHistoryRepository barcodeScanHistoryRepository;
    private final ProductReturnRepository productReturnRepository;
    private final SupplierProductRepository supplierProductRepository;
    private final InvoiceRepository invoiceRepository;
    private final SupplierDispatchRepository supplierDispatchRepository;
    private final TheftRecordRepository theftRecordRepository;
    private final StockVerificationRepository stockVerificationRepository;
    private final SecurityUtils securityUtils;
    private final NotificationService notificationService;
    private final com.smartinventory.email.EmailService emailService;
    private final AdminRepository adminRepository;
    private final BranchRepository branchRepository;
    private final AuditLogRepository auditLogRepository;
    private final SupplierRepository supplierRepository;
    private final DamageInventoryRepository damageInventoryRepository;

    @org.springframework.beans.factory.annotation.Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Transactional
    public void logScan(String barcode, String productName, Long productId, String action, String device) {
        String email = securityUtils.getCurrentAdmin().getEmail();
        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        String branchName = null;
        if (branchId != null) {
            branchName = branchRepository.findById(branchId).map(Branch::getName).orElse(null);
        }

        BarcodeScanHistory logEntry = BarcodeScanHistory.builder()
                .barcode(barcode)
                .productName(productName)
                .productId(productId)
                .userEmail(email)
                .userRole("OWNER")
                .branchId(branchId)
                .adminId(admin.getId())
                .branchName(branchName)
                .action(action)
                .device(device != null ? device : "Webcam Scanner")
                .build();
        barcodeScanHistoryRepository.save(logEntry);

        auditLogRepository.save(AuditLog.builder()
                .ownerId(admin.getId())
                .branchId(branchId)
                .productId(productId)
                .action("BARCODE_SCAN")
                .productName(productName)
                .quantity(1)
                .userEmail(email)
                .build());
    }

    public Map<String, Object> verifyExpiryAndGetStatus(Product product, Admin admin) {
        Map<String, Object> result = new HashMap<>();
        String expiryStatus = "OK";
        LocalDate expiryDate = null;

        var batchOpt = productBatchRepository.findFirstAvailableBatch(product, admin, product.getBranch());
        if (batchOpt.isPresent()) {
            var batch = batchOpt.get();
            expiryDate = batch.getExpiryDate();
            if (expiryDate != null) {
                String category = product.getCategory() != null ? product.getCategory().trim().toLowerCase() : "";
                java.util.List<String> noDateCats = java.util.List.of(
                        "dress", "clothing", "boxes", "plastic products", "stationery", "furniture",
                        "dresses", "box", "plastic"
                );
                boolean checkExpiry = !noDateCats.contains(category);
                if (checkExpiry) {
                    if (expiryDate.isBefore(LocalDate.now())) {
                        expiryStatus = "EXPIRED";
                        if (!"Expired".equalsIgnoreCase(product.getStatus())) {
                            product.setStatus("Expired");
                            productRepository.save(product);
                        }
                    } else if (expiryDate.isBefore(LocalDate.now().plusDays(5))) {
                        expiryStatus = "NEAR_EXPIRY";
                        if (!"Expiring Soon".equalsIgnoreCase(product.getStatus())) {
                            product.setStatus("Expiring Soon");
                            productRepository.save(product);
                        }
                    }
                }
            }
        }

        result.put("status", expiryStatus);
        result.put("expiryDate", expiryDate);
        return result;
    }

    @Transactional
    public ApiResponse<Map<String, Object>> performBarcodeLookup(String barcode, String action, String device) {
        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        String normalizedBarcode = barcode == null ? "" : barcode.trim();
        log.info("Barcode lookup received: barcode='{}', ownerId={}, branchId={}, action={}", normalizedBarcode, admin.getId(), branchId, action);
        log.debug("Executing ProductRepository barcode lookup: SELECT p WHERE p.barcode='{}' AND p.admin.id={} AND p.branch.id={}",
                normalizedBarcode, admin.getId(), branchId);
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(admin.getId());
            if (!branches.isEmpty()) {
                return ApiResponse.error("Access denied: Branch selection is required.");
            }
        }

        Product product = productRepository.findByBarcodeAndAdminAndBranchId(normalizedBarcode, admin, branchId).orElse(null);
        Map<String, Object> response = new HashMap<>();
        response.put("barcode", normalizedBarcode);

        if (product != null) {
            log.info("Barcode lookup matched productId={} name='{}' ownerId={} branchId={}", product.getId(), product.getName(), admin.getId(), branchId);
            // Verify branch security constraint
            if (product.getBranch() == null || !product.getBranch().getId().equals(branchId)) {
                logScan(normalizedBarcode, product.getName(), product.getId(), "FAILED_ACCESS_DENIED", device);
                return ApiResponse.error("Access denied: Product belongs to another branch.");
            }

            // Expiry checks
            Map<String, Object> expiry = verifyExpiryAndGetStatus(product, admin);
            String expiryStatus = (String) expiry.get("status");
            LocalDate expiryDate = (LocalDate) expiry.get("expiryDate");

            response.put("productFound", true);
            response.put("productId", product.getId());
            response.put("productName", product.getName());
            response.put("category", product.getCategory());
            response.put("currentStock", product.getCurrentStock());
            response.put("sellingPrice", product.getSellingPrice());
            response.put("expiryStatus", expiryStatus);
            response.put("expiryDate", expiryDate);

            // Fetch details for Supplier Search requirements
            if (product.getSupplier() != null) {
                response.put("supplierName", product.getSupplier().getCompanyName());
            }

            // Add batch details
            productBatchRepository.findFirstAvailableBatch(product, admin, product.getBranch()).ifPresent(batch -> {
                response.put("batchId", batch.getId());
                response.put("batchNumber", batch.getBatchNumber());
            });

            // Trigger alerts & emails for NEAR_EXPIRY
            if ("NEAR_EXPIRY".equals(expiryStatus)) {
                String alertMsg = "Product " + product.getName() + " is nearing expiration (" + expiryDate + ").";
                notificationService.createNotification(admin.getId(), branchId, "LOW_STOCK", alertMsg, "PRODUCT", product.getId());
                if (product.getSupplier() != null) {
                    notificationService.createNotification(-product.getSupplier().getId(), "LOW_STOCK", alertMsg, "PRODUCT", product.getId());
                    emailService.sendExpiryAlertEmail(product.getSupplier().getEmail(), product.getSupplier().getSupplierName(), product.getName(), "⚠ Near Expiry", expiryDate);
                }
                emailService.sendExpiryAlertEmail(admin.getEmail(), admin.getFullName(), product.getName(), "⚠ Near Expiry", expiryDate);
            }

            logScan(normalizedBarcode, product.getName(), product.getId(), action != null ? action : "SEARCH", device);
        } else {
            log.warn("Barcode lookup found no product for barcode='{}', ownerId={}, branchId={}", normalizedBarcode, admin.getId(), branchId);
            response.put("productFound", false);
            logScan(normalizedBarcode, "Unknown Product", null, "FAILED_NOT_FOUND", device);
        }

        return ApiResponse.success("Lookup complete", response);
    }

    @Transactional
    public ApiResponse<List<Map<String, Object>>> verifyInventory(Map<String, Integer> scannedItems, String notes) {
        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(admin.getId());
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<Map<String, Object>> report = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (Map.Entry<String, Integer> entry : scannedItems.entrySet()) {
            String barcode = entry.getKey();
            Integer actualStock = entry.getValue();

            Product product = productRepository.findByBarcodeAndAdminAndBranchId(barcode, admin, branchId)
                    .orElseThrow(() -> new RuntimeException("Product not found for barcode: " + barcode));

            if (product.getBranch() == null || !product.getBranch().getId().equals(branchId)) {
                throw new RuntimeException("Product " + product.getName() + " does not belong to the current branch.");
            }

            int expected = product.getCurrentStock();
            int shortage = expected - actualStock;
            Map<String, Object> itemReport = new HashMap<>();
            itemReport.put("barcode", barcode);
            itemReport.put("productName", product.getName());
            itemReport.put("expectedStock", expected);
            itemReport.put("actualStock", actualStock);
            itemReport.put("difference", shortage);

            if (shortage == 0) {
                itemReport.put("status", "Inventory Verified");
            } else {
                itemReport.put("status", shortage > 0 ? "Shortage" : "Extra Stock");
                if (shortage > 0) {
                    // Only create TheftRecord if actual count is less than expected
                    BigDecimal lossValue = product.getSellingPrice().multiply(BigDecimal.valueOf(shortage));
                    TheftRecord theft = TheftRecord.builder()
                            .admin(admin)
                            .branch(product.getBranch())
                            .product(product)
                            .productName(product.getName())
                            .openingStock(product.getOpeningStock())
                            .soldQuantity(0)
                            .expectedStock(expected)
                            .actualStock(actualStock)
                            .missingQuantity(shortage)
                            .damagedQuantity(0)
                            .unexplainedLoss(shortage)
                            .lossValue(lossValue)
                            .detectionDate(today)
                            .status(TheftRecord.TheftStatus.DETECTED)
                            .adminNotes(notes != null ? notes : "Shortage identified during Barcode Inventory Verification.")
                            .build();
                    theftRecordRepository.save(theft);

                    // Notify Owner
                    notificationService.createNotification(admin.getId(), branchId, "THEFT_ALERT",
                            "AI Theft Alert: Shortage of " + shortage + " units detected for " + product.getName(), "THEFT_RECORD", theft.getId());

                    // Send email alert to owner
                    emailService.sendTheftAlertEmail(admin.getEmail(), admin.getFullName(), product.getName(), shortage, lossValue.doubleValue());
                }
            }

            // Save verification audit report context: update stock to verified actual count
            product.setCurrentStock(actualStock);
            productRepository.save(product);

            logScan(barcode, product.getName(), product.getId(), "VERIFICATION", "Webcam Scanner");
            report.add(itemReport);
        }

        // Save Verification Report State in StockVerification database
        StockVerification verification = stockVerificationRepository
                .findByAdminIdAndVerificationDate(admin.getId(), today)
                .orElse(StockVerification.builder().admin(admin).verificationDate(today).build());
        verification.setStatus(StockVerification.VerificationStatus.COMPLETED);
        verification.setCompletedAt(LocalDateTime.now());
        stockVerificationRepository.save(verification);

        return ApiResponse.success("Inventory verification complete", report);
    }

    @Transactional
    public ApiResponse<Map<String, Object>> submitCustomerReturnRequest(
            String invoiceNumber, String barcode, Integer quantity, String condition, String notes, List<org.springframework.web.multipart.MultipartFile> files) {
        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) throw new RuntimeException("Branch selection is required");
        if (quantity == null || quantity <= 0) throw new RuntimeException("Invalid return quantity.");

        Invoice invoice = invoiceRepository.findByInvoiceNumberAndAdminIdAndBranchId(invoiceNumber, admin.getId(), branchId)
                .orElseThrow(() -> new RuntimeException("Invoice not found."));

        if (invoice.getBranch() == null || !invoice.getBranch().getId().equals(branchId)) {
            throw new RuntimeException("Invoice does not belong to the active branch.");
        }

        InvoiceItem matchItem = invoice.getItems().stream()
                .filter(item -> item.getProduct().getBarcode() != null && item.getProduct().getBarcode().equals(barcode))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Product not found in invoice."));

        Product product = matchItem.getProduct();
        if (product.getBranch() == null || !product.getBranch().getId().equals(branchId)) {
            throw new RuntimeException("Product does not belong to the active branch.");
        }

        // Calculate quantity already returned (APPROVED or RESOLVED)
        List<ProductReturn> existingReturns = productReturnRepository.findByAdminIdAndBranchIdOrderByCreatedAtDesc(admin.getId(), branchId);
        int returnedQty = 0;
        for (ProductReturn r : existingReturns) {
            if ("CUSTOMER_TO_OWNER".equals(r.getReturnType()) && invoiceNumber.equals(r.getInvoiceNumber()) && barcode.equals(r.getBarcode())) {
                if (!"REJECTED".equals(r.getStatus())) {
                    returnedQty += r.getQuantity();
                }
            }
        }

        int availableQuantity = matchItem.getQuantity() - returnedQty;
        if (quantity > availableQuantity) {
            throw new RuntimeException("Return quantity exceeds the available returnable quantity (" + availableQuantity + ").");
        }

        String evidenceUrls = null;
        if ("DAMAGED".equalsIgnoreCase(condition)) {
            if (files == null || files.isEmpty() || files.stream().allMatch(org.springframework.web.multipart.MultipartFile::isEmpty)) {
                throw new RuntimeException("At least one damage evidence image is required.");
            }
            if (files.size() > 5) {
                throw new RuntimeException("A maximum of 5 images can be uploaded.");
            }
            List<String> evidenceUrlsList = new java.util.ArrayList<>();
            for (org.springframework.web.multipart.MultipartFile file : files) {
                String savedPath = saveReturnEvidence(file);
                if (savedPath != null) {
                    evidenceUrlsList.add(savedPath);
                }
            }
            evidenceUrls = String.join(",", evidenceUrlsList);
        }

        // Save return record as PENDING_OWNER_APPROVAL
        ProductReturn returnRecord = ProductReturn.builder()
                .adminId(admin.getId())
                .branchId(branchId)
                .barcode(barcode)
                .productName(product.getName())
                .quantity(quantity)
                .returnType("CUSTOMER_TO_OWNER")
                .invoiceNumber(invoiceNumber)
                .notes(notes)
                .condition(condition.toUpperCase())
                .status("PENDING_OWNER_APPROVAL")
                .evidenceUrls(evidenceUrls)
                .build();
        productReturnRepository.save(returnRecord);

        logScan(barcode, product.getName(), product.getId(), "CUSTOMER_RETURN", "Webcam Scanner");

        Map<String, Object> res = new HashMap<>();
        res.put("id", returnRecord.getId());
        res.put("returnedProduct", product.getName());
        res.put("quantity", quantity);
        res.put("status", returnRecord.getStatus());
        return ApiResponse.success("Customer return request submitted successfully and is pending owner approval.", res);
    }

    public ApiResponse<List<Map<String, Object>>> getCustomerReturnProducts(String invoiceNumber) {
        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) throw new RuntimeException("Branch selection is required");

        Invoice invoice = invoiceRepository.findByInvoiceNumberAndAdminIdAndBranchId(invoiceNumber, admin.getId(), branchId)
                .orElseThrow(() -> new RuntimeException("Invoice not found."));

        List<Map<String, Object>> products = invoice.getItems().stream().map(item -> {
            String barcode = item.getProduct().getBarcode();
            int returnedQuantity = barcode == null ? 0 : productReturnRepository.sumCustomerReturnedQuantity(
                    admin.getId(), branchId, invoiceNumber, barcode);
            Map<String, Object> product = new HashMap<>();
            product.put("productId", item.getProduct().getId());
            product.put("productName", item.getProductName());
            product.put("barcode", barcode);
            product.put("billedQuantity", item.getQuantity());
            product.put("returnedQuantity", returnedQuantity);
            product.put("availableReturnQuantity", Math.max(0, item.getQuantity() - returnedQuantity));
            return product;
        }).toList();

        return ApiResponse.success("Invoice products retrieved", products);
    }

    private String saveReturnEvidence(org.springframework.web.multipart.MultipartFile file) {
        if (file == null || file.isEmpty()) return null;

        String originalName = file.getOriginalFilename() != null
                ? file.getOriginalFilename().toLowerCase() : "";
        if (!originalName.matches(".*\\.(jpg|jpeg|png)$")) {
            throw new RuntimeException("Only JPG, JPEG, and PNG images are allowed");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new RuntimeException("Image size must not exceed 5 MB");
        }

        try {
            java.nio.file.Path dir = java.nio.file.Paths.get(uploadDir, "returns").toAbsolutePath().normalize();
            java.nio.file.Files.createDirectories(dir);

            String ext      = originalName.substring(originalName.lastIndexOf('.'));
            String filename = UUID.randomUUID() + ext;
            java.nio.file.Path dest = dir.resolve(filename);
            java.nio.file.Files.copy(file.getInputStream(), dest, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

            return "/uploads/returns/" + filename;
        } catch (java.io.IOException e) {
            throw new RuntimeException("Failed to save evidence image: " + e.getMessage());
        }
    }

    @Transactional
    public ApiResponse<Map<String, Object>> processSupplierReturn(
            String barcode, Integer quantity, String notes, List<org.springframework.web.multipart.MultipartFile> files) {
        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(admin.getId());
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }

        Product product = productRepository.findByBarcodeAndAdminAndBranchId(barcode, admin, branchId)
                .orElseThrow(() -> new RuntimeException("Product not found with barcode: " + barcode));

        if (product.getBranch() == null || !product.getBranch().getId().equals(branchId)) {
            throw new RuntimeException("Product does not belong to the active branch.");
        }

        if (product.getCurrentStock() < quantity) {
            throw new RuntimeException("Insufficient stock in store to process return. Available: " + product.getCurrentStock());
        }

        // Image validation: At least one damage image is required for returns evidence
        if (files == null || files.isEmpty() || files.stream().allMatch(org.springframework.web.multipart.MultipartFile::isEmpty)) {
            throw new RuntimeException("At least one damage image is required for returns evidence.");
        }
        if (files.size() > 5) {
            throw new RuntimeException("A maximum of 5 images can be uploaded.");
        }


        // Save files
        List<String> evidenceUrlsList = new java.util.ArrayList<>();
        for (org.springframework.web.multipart.MultipartFile file : files) {
            String savedPath = saveReturnEvidence(file);
            if (savedPath != null) {
                evidenceUrlsList.add(savedPath);
            }
        }
        if (evidenceUrlsList.isEmpty()) {
            throw new RuntimeException("At least one valid damage image is required.");
        }
        String evidenceUrls = String.join(",", evidenceUrlsList);

        // Find Supplier
        SupplierProduct sp = supplierProductRepository.findByBarcodeNumber(barcode).orElse(null);
        Long supplierId = null;
        if (sp != null && sp.getSupplier() != null) {
            supplierId = sp.getSupplier().getId();
        } else {
            Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId()).orElse(null);
            List<SupplierDispatch> dispatches = supplierDispatchRepository.findAllByAdminAndBranchOrderByDispatchDateDesc(admin, branch);
            for (SupplierDispatch sd : dispatches) {
                if (sd.getSupplierProduct() != null && barcode.equals(sd.getSupplierProduct().getBarcodeNumber())) {
                    supplierId = sd.getSupplier().getId();
                    break;
                }
            }
        }
        if (supplierId == null) {
            throw new RuntimeException("Could not identify the supplier for this product barcode.");
        }

        // Save return record as PENDING status
        ProductReturn returnRecord = ProductReturn.builder()
                .adminId(admin.getId())
                .branchId(branchId)
                .barcode(barcode)
                .productName(product.getName())
                .quantity(quantity)
                .returnType("OWNER_TO_SUPPLIER")
                .notes(notes)
                .supplierId(supplierId)
                .status("PENDING")
                .evidenceUrls(evidenceUrls)
                .aiConfidenceScore(null)
                .aiValidationStatus("SKIPPED")
                .build();
        productReturnRepository.save(returnRecord);

        // Notify Supplier
        String msg = "Owner created a Return Request for " + quantity + " units of " + product.getName() + " (Pending approval).";
        notificationService.createNotification(-supplierId, "SUPPLIER_RETURN", msg, "SUPPLIER_DISPATCH", returnRecord.getId());

        logScan(barcode, product.getName(), product.getId(), "SUPPLIER_RETURN", "Webcam Scanner");

        Map<String, Object> res = new HashMap<>();
        res.put("id", returnRecord.getId());
        res.put("returnedProduct", product.getName());
        res.put("quantity", quantity);
        res.put("status", returnRecord.getStatus());
        return ApiResponse.success("Return Request created successfully and is pending supplier approval.", res);
    }

    @Transactional
    public ApiResponse<Map<String, Object>> acceptSupplierReturn(Long returnId) {
        ProductReturn returnRecord = productReturnRepository.findById(returnId)
                .orElseThrow(() -> new RuntimeException("Return request not found"));

        if (!"PENDING".equals(returnRecord.getStatus())) {
            throw new RuntimeException("Return request is already " + returnRecord.getStatus());
        }

        // Run the existing business logic:
        Admin admin = adminRepository.findById(returnRecord.getAdminId())
                .orElseThrow(() -> new RuntimeException("Admin not found"));
        Long branchId = returnRecord.getBranchId();

        Product product = productRepository.findByBarcodeAndAdminAndBranchId(
                returnRecord.getBarcode(), admin, branchId)
                .orElseThrow(() -> new RuntimeException("Product not found with barcode: " + returnRecord.getBarcode()));

        if (product.getCurrentStock() < returnRecord.getQuantity()) {
            throw new RuntimeException("Insufficient stock in store to process return. Available: " + product.getCurrentStock());
        }

        // If condition was DAMAGED, reduce DamageInventory. Otherwise, reduce standard stock
        if ("DAMAGED".equalsIgnoreCase(returnRecord.getCondition())) {
            DamageInventory dmgInv = damageInventoryRepository.findByAdminIdAndBranchIdAndProduct(admin.getId(), branchId, product)
                    .orElseThrow(() -> new RuntimeException("Damage inventory record not found for this product"));
            dmgInv.setQuantity(Math.max(0, dmgInv.getQuantity() - returnRecord.getQuantity()));
            damageInventoryRepository.save(dmgInv);
        } else {
            if (product.getCurrentStock() < returnRecord.getQuantity()) {
                throw new RuntimeException("Insufficient stock in store to process return. Available: " + product.getCurrentStock());
            }
            // Reduce inventory
            product.setCurrentStock(product.getCurrentStock() - returnRecord.getQuantity());
            productRepository.save(product);
        }

        // Update last accepted supplier dispatch if found to mark it returned
        Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId()).orElse(null);
        List<SupplierDispatch> dispatches = supplierDispatchRepository.findAllByAdminAndBranchOrderByDispatchDateDesc(admin, branch);
        for (SupplierDispatch sd : dispatches) {
            if (sd.getSupplierProduct() != null && returnRecord.getBarcode().equals(sd.getSupplierProduct().getBarcodeNumber()) && "ACCEPTED".equals(sd.getStatus())) {
                sd.setStatus("RETURNED");
                sd.setRejectionReason(returnRecord.getNotes() != null ? returnRecord.getNotes() : "Returned to supplier");
                supplierDispatchRepository.save(sd);
                break;
            }
        }

        // Update return status to ACCEPTED
        returnRecord.setStatus("ACCEPTED");
        productReturnRepository.save(returnRecord);

        // Audit Log for supplier return
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogRepository.save(AuditLog.builder()
                .ownerId(admin.getId())
                .branchId(branchId)
                .productId(product.getId())
                .action("RETURN")
                .productName(product.getName())
                .quantity(returnRecord.getQuantity())
                .userEmail(email)
                .build());

        // Audit Log for stock reduction (if it was a standard catalog return)
        if (!"DAMAGED".equalsIgnoreCase(returnRecord.getCondition())) {
            auditLogRepository.save(AuditLog.builder()
                    .ownerId(admin.getId())
                    .branchId(branchId)
                    .productId(product.getId())
                    .action("STOCK_REDUCED")
                    .productName(product.getName())
                    .quantity(returnRecord.getQuantity())
                    .userEmail(email)
                    .build());
        }

        // Notify Owner
        String msg = "Supplier accepted return of " + returnRecord.getQuantity() + " units of " + product.getName() + ".";
        notificationService.createNotification(admin.getId(), branchId, "SUPPLIER_RETURN", msg, "SUPPLIER_DISPATCH", returnRecord.getId());

        Map<String, Object> res = new HashMap<>();
        res.put("id", returnId);
        res.put("status", "ACCEPTED");
        return ApiResponse.success("Return Request accepted and inventory updated.", res);
    }

    @Transactional
    public ApiResponse<Map<String, Object>> rejectSupplierReturn(Long returnId, String reason) {
        ProductReturn returnRecord = productReturnRepository.findById(returnId)
                .orElseThrow(() -> new RuntimeException("Return request not found"));

        if (!"PENDING".equals(returnRecord.getStatus())) {
            throw new RuntimeException("Return request is already " + returnRecord.getStatus());
        }

        returnRecord.setStatus("REJECTED");
        returnRecord.setRejectionReason(reason);
        productReturnRepository.save(returnRecord);

        // Notify Owner
        Admin admin = adminRepository.findById(returnRecord.getAdminId()).orElse(null);
        if (admin != null) {
            String msg = "Supplier rejected return of " + returnRecord.getQuantity() + " units of " + returnRecord.getProductName() + ". Reason: " + reason;
            notificationService.createNotification(admin.getId(), returnRecord.getBranchId(), "SUPPLIER_RETURN", msg, "SUPPLIER_DISPATCH", returnRecord.getId());
        }

        Map<String, Object> res = new HashMap<>();
        res.put("id", returnId);
        res.put("status", "REJECTED");
        res.put("rejectionReason", reason);
        return ApiResponse.success("Return Request rejected.", res);
    }

    public ApiResponse<List<ProductReturn>> getSupplierReturns() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        Supplier supplier = supplierRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Supplier profile not found"));

        List<ProductReturn> list = productReturnRepository.findBySupplierIdOrderByCreatedAtDesc(supplier.getId());
        return ApiResponse.success("Supplier returns retrieved", list);
    }

    public ApiResponse<List<ProductReturn>> getOwnerReturns() {
        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        List<ProductReturn> list = productReturnRepository.findByAdminIdAndBranchIdOrderByCreatedAtDesc(admin.getId(), branchId);
        return ApiResponse.success("Owner returns retrieved", list);
    }

    public ApiResponse<List<BarcodeScanHistory>> getScanHistory() {
        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(admin.getId());
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<BarcodeScanHistory> history = barcodeScanHistoryRepository.findByAdminIdAndBranchIdOrderByDateTimeDesc(admin.getId(), branchId);
        return ApiResponse.success("Scan history retrieved", history);
    }

    @Transactional
    public void handleLowStockAlerts(Product product, Admin admin) {
        if (product.getCurrentStock() <= product.getMinimumStockAlert()) {
            int recommendedReorder = product.getMinimumStockAlert() * 5; // AI Recommendation
            String message = "Low Stock Alert: " + product.getName() + " has dropped to " + product.getCurrentStock()
                    + " units (Min: " + product.getMinimumStockAlert() + "). AI recommended reorder quantity: " + recommendedReorder + ".";

            Long branchId = product.getBranch() != null ? product.getBranch().getId() : null;

            // Notify Owner
            notificationService.createNotification(admin.getId(), branchId, "LOW_STOCK", message, "PRODUCT", product.getId());

            // Notify Supplier (if any)
            if (product.getSupplier() != null) {
                String supplierMessage = "Purchase recommendation: Owner " + admin.getShopName() + " needs "
                        + recommendedReorder + " units of " + product.getName() + " due to low stock.";
                notificationService.createNotification(-product.getSupplier().getId(),
                        "LOW_STOCK", supplierMessage, "PRODUCT", product.getId());

                // Email supplier
                emailService.sendLowStockAlertEmail(product.getSupplier().getEmail(), product.getSupplier().getSupplierName(),
                        product.getName(), product.getCurrentStock(), product.getMinimumStockAlert(), recommendedReorder);
            }

            // Email Owner
            emailService.sendLowStockAlertEmail(admin.getEmail(), admin.getFullName(),
                    product.getName(), product.getCurrentStock(), product.getMinimumStockAlert(), recommendedReorder);
        }
    }

    @Transactional
    public ApiResponse<Map<String, Object>> approveCustomerReturn(Long returnId) {
        ProductReturn returnRecord = productReturnRepository.findById(returnId)
                .orElseThrow(() -> new RuntimeException("Return request not found"));

        if (!"PENDING_OWNER_APPROVAL".equals(returnRecord.getStatus())) {
            throw new RuntimeException("Return request is already " + returnRecord.getStatus());
        }

        Admin admin = adminRepository.findById(returnRecord.getAdminId())
                .orElseThrow(() -> new RuntimeException("Admin not found"));
        Long branchId = returnRecord.getBranchId();

        Product product = productRepository.findByBarcodeAndAdminAndBranchId(
                returnRecord.getBarcode(), admin, branchId)
                .orElseThrow(() -> new RuntimeException("Product not found with barcode: " + returnRecord.getBarcode()));

        // If DAMAGED, automatically create a Supplier Return Request and increment DamageInventory
        if ("DAMAGED".equalsIgnoreCase(returnRecord.getCondition())) {
            // Find Supplier
            SupplierProduct sp = supplierProductRepository.findByBarcodeNumber(returnRecord.getBarcode()).orElse(null);
            Long supplierId = null;
            if (sp != null && sp.getSupplier() != null) {
                supplierId = sp.getSupplier().getId();
            } else {
                Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId()).orElse(null);
                List<SupplierDispatch> dispatches = supplierDispatchRepository.findAllByAdminAndBranchOrderByDispatchDateDesc(admin, branch);
                for (SupplierDispatch sd : dispatches) {
                    if (sd.getSupplierProduct() != null && returnRecord.getBarcode().equals(sd.getSupplierProduct().getBarcodeNumber())) {
                        supplierId = sd.getSupplier().getId();
                        break;
                    }
                }
            }
            if (supplierId == null) {
                log.warn("Could not identify the supplier for auto supplier return request.");
            } else {
                // Auto create Supplier Return Request
                ProductReturn supplierRequest = ProductReturn.builder()
                        .adminId(admin.getId())
                        .branchId(branchId)
                        .barcode(returnRecord.getBarcode())
                        .productName(returnRecord.getProductName())
                        .quantity(returnRecord.getQuantity())
                        .returnType("OWNER_TO_SUPPLIER")
                        .notes("Auto-generated from approved Customer Return: " + returnRecord.getNotes())
                        .supplierId(supplierId)
                        .status("PENDING")
                        .evidenceUrls(returnRecord.getEvidenceUrls())
                        .condition("DAMAGED")
                        .build();
                productReturnRepository.save(supplierRequest);

                // Notify Supplier
                String msg = "Owner created a Return Request for " + returnRecord.getQuantity() + " units of " + product.getName() + " (Pending approval).";
                notificationService.createNotification(-supplierId, "SUPPLIER_RETURN", msg, "SUPPLIER_DISPATCH", supplierRequest.getId());
            }

            // Move to Damage Inventory
            DamageInventory dmgInv = damageInventoryRepository.findByAdminIdAndBranchIdAndProduct(admin.getId(), branchId, product)
                    .orElseGet(() -> DamageInventory.builder()
                            .admin(admin)
                            .branch(branchRepository.findByIdAndAdminId(branchId, admin.getId()).orElse(null))
                            .product(product)
                            .quantity(0)
                            .build());
            dmgInv.setQuantity(dmgInv.getQuantity() + returnRecord.getQuantity());
            damageInventoryRepository.save(dmgInv);
        }

        returnRecord.setStatus("APPROVED");
        productReturnRepository.save(returnRecord);

        Map<String, Object> res = new HashMap<>();
        res.put("id", returnId);
        res.put("status", "APPROVED");
        return ApiResponse.success("Return Request approved. Customer must choose Refund or Exchange.", res);
    }

    @Transactional
    public ApiResponse<Map<String, Object>> rejectCustomerReturn(Long returnId, String reason) {
        ProductReturn returnRecord = productReturnRepository.findById(returnId)
                .orElseThrow(() -> new RuntimeException("Return request not found"));

        if (!"PENDING_OWNER_APPROVAL".equals(returnRecord.getStatus())) {
            throw new RuntimeException("Return request is already " + returnRecord.getStatus());
        }

        returnRecord.setStatus("REJECTED");
        returnRecord.setRejectionReason(reason);
        productReturnRepository.save(returnRecord);

        Map<String, Object> res = new HashMap<>();
        res.put("id", returnId);
        res.put("status", "REJECTED");
        return ApiResponse.success("Return Request rejected.", res);
    }

    @Transactional
    public ApiResponse<Map<String, Object>> processCustomerRefund(Long returnId, String refundMethod) {
        ProductReturn returnRecord = productReturnRepository.findById(returnId)
                .orElseThrow(() -> new RuntimeException("Return request not found"));

        if (!"APPROVED".equals(returnRecord.getStatus())) {
            throw new RuntimeException("Return request must be APPROVED before processing refund.");
        }

        Admin admin = adminRepository.findById(returnRecord.getAdminId())
                .orElseThrow(() -> new RuntimeException("Admin not found"));
        Long branchId = returnRecord.getBranchId();

        Product product = productRepository.findByBarcodeAndAdminAndBranchId(
                returnRecord.getBarcode(), admin, branchId)
                .orElseThrow(() -> new RuntimeException("Product not found with barcode: " + returnRecord.getBarcode()));

        Invoice invoice = invoiceRepository.findByInvoiceNumberAndAdminIdAndBranchId(
                returnRecord.getInvoiceNumber(), admin.getId(), branchId)
                .orElseThrow(() -> new RuntimeException("Invoice not found."));

        InvoiceItem matchItem = invoice.getItems().stream()
                .filter(item -> item.getProduct().getBarcode() != null && item.getProduct().getBarcode().equals(returnRecord.getBarcode()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Product not found in invoice."));

        BigDecimal refundAmount = matchItem.getUnitPrice().multiply(BigDecimal.valueOf(returnRecord.getQuantity()));

        returnRecord.setCustomerDecision("REFUND");
        returnRecord.setRefundAmount(refundAmount);
        returnRecord.setRefundMethod(refundMethod);
        returnRecord.setRefundDate(LocalDateTime.now());
        returnRecord.setProcessedBy(org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName());
        returnRecord.setStatus("RESOLVED_REFUND");
        productReturnRepository.save(returnRecord);

        if ("GOOD".equalsIgnoreCase(returnRecord.getCondition())) {
            product.setCurrentStock(product.getCurrentStock() + returnRecord.getQuantity());
            productRepository.save(product);

            auditLogRepository.save(AuditLog.builder()
                    .ownerId(admin.getId())
                    .branchId(branchId)
                    .productId(product.getId())
                    .action("STOCK_ADDED")
                    .productName(product.getName())
                    .quantity(returnRecord.getQuantity())
                    .userEmail(returnRecord.getProcessedBy())
                    .build());
        }

        List<ProductReturn> allInvoiceReturns = productReturnRepository.findByAdminIdAndBranchIdOrderByCreatedAtDesc(admin.getId(), branchId);
        boolean allItemsRefunded = true;
        for (InvoiceItem item : invoice.getItems()) {
            int itemRefundedQty = 0;
            for (ProductReturn r : allInvoiceReturns) {
                if ("CUSTOMER_TO_OWNER".equals(r.getReturnType()) && invoice.getInvoiceNumber().equals(r.getInvoiceNumber()) && item.getProduct().getBarcode().equals(r.getBarcode())) {
                    if ("RESOLVED_REFUND".equals(r.getStatus()) || "RESOLVED_EXCHANGE".equals(r.getStatus())) {
                        itemRefundedQty += r.getQuantity();
                    }
                }
            }
            if (itemRefundedQty < item.getQuantity()) {
                allItemsRefunded = false;
                break;
            }
        }

        invoice.setStatus(allItemsRefunded ? Invoice.InvoiceStatus.FULLY_REFUNDED : Invoice.InvoiceStatus.PARTIALLY_REFUNDED);
        invoiceRepository.save(invoice);

        auditLogRepository.save(AuditLog.builder()
                .ownerId(admin.getId())
                .branchId(branchId)
                .productId(product.getId())
                .action("RETURN")
                .productName(product.getName())
                .quantity(returnRecord.getQuantity())
                .userEmail(returnRecord.getProcessedBy())
                .build());

        Map<String, Object> res = new HashMap<>();
        res.put("id", returnId);
        res.put("refundAmount", refundAmount);
        res.put("status", "RESOLVED_REFUND");
        return ApiResponse.success("Refund processed successfully.", res);
    }

    @Transactional
    public ApiResponse<Map<String, Object>> processCustomerExchange(Long returnId, String exchangeBarcode, Integer exchangeQty) {
        ProductReturn returnRecord = productReturnRepository.findById(returnId)
                .orElseThrow(() -> new RuntimeException("Return request not found"));

        if (!"APPROVED".equals(returnRecord.getStatus())) {
            throw new RuntimeException("Return request must be APPROVED before processing exchange.");
        }

        Admin admin = adminRepository.findById(returnRecord.getAdminId())
                .orElseThrow(() -> new RuntimeException("Admin not found"));
        Long branchId = returnRecord.getBranchId();

        Product returnedProduct = productRepository.findByBarcodeAndAdminAndBranchId(
                returnRecord.getBarcode(), admin, branchId)
                .orElseThrow(() -> new RuntimeException("Product not found with barcode: " + returnRecord.getBarcode()));

        Product exchangeProduct = productRepository.findByBarcodeAndAdminAndBranchId(
                exchangeBarcode, admin, branchId)
                .orElseThrow(() -> new RuntimeException("Exchange product not found with barcode: " + exchangeBarcode));

        if (exchangeProduct.getCurrentStock() < exchangeQty) {
            throw new RuntimeException("Insufficient stock for exchange product. Available: " + exchangeProduct.getCurrentStock());
        }

        Invoice originalInvoice = invoiceRepository.findByInvoiceNumberAndAdminIdAndBranchId(
                returnRecord.getInvoiceNumber(), admin.getId(), branchId)
                .orElseThrow(() -> new RuntimeException("Original invoice not found."));

        InvoiceItem matchItem = originalInvoice.getItems().stream()
                .filter(item -> item.getProduct().getBarcode() != null && item.getProduct().getBarcode().equals(returnRecord.getBarcode()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Product not found in invoice."));

        BigDecimal oldPrice = matchItem.getUnitPrice().multiply(BigDecimal.valueOf(returnRecord.getQuantity()));
        BigDecimal newPrice = exchangeProduct.getSellingPrice().multiply(BigDecimal.valueOf(exchangeQty));
        BigDecimal priceDifference = newPrice.subtract(oldPrice);

        exchangeProduct.setCurrentStock(exchangeProduct.getCurrentStock() - exchangeQty);
        productRepository.save(exchangeProduct);

        if ("GOOD".equalsIgnoreCase(returnRecord.getCondition())) {
            returnedProduct.setCurrentStock(returnedProduct.getCurrentStock() + returnRecord.getQuantity());
            productRepository.save(returnedProduct);

            auditLogRepository.save(AuditLog.builder()
                    .ownerId(admin.getId())
                    .branchId(branchId)
                    .productId(returnedProduct.getId())
                    .action("STOCK_ADDED")
                    .productName(returnedProduct.getName())
                    .quantity(returnRecord.getQuantity())
                    .userEmail(org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName())
                    .build());
        }

        String newInvoiceNumber = "EXCH-" + System.currentTimeMillis();
        Invoice newInvoice = Invoice.builder()
                .admin(admin)
                .branch(originalInvoice.getBranch())
                .branchName(originalInvoice.getBranchName())
                .branchCode(originalInvoice.getBranchCode())
                .invoiceNumber(newInvoiceNumber)
                .customer(originalInvoice.getCustomer())
                .staff(originalInvoice.getStaff())
                .subtotal(newPrice)
                .totalAmount(newPrice)
                .status(Invoice.InvoiceStatus.PAID)
                .paymentMethod(originalInvoice.getPaymentMethod())
                .notes("Exchange invoice linked to original: " + originalInvoice.getInvoiceNumber())
                .build();

        InvoiceItem newItem = InvoiceItem.builder()
                .invoice(newInvoice)
                .product(exchangeProduct)
                .productName(exchangeProduct.getName())
                .quantity(exchangeQty)
                .unitPrice(exchangeProduct.getSellingPrice())
                .totalPrice(newPrice)
                .build();
        newInvoice.setItems(List.of(newItem));
        invoiceRepository.save(newInvoice);

        returnRecord.setCustomerDecision("EXCHANGE");
        returnRecord.setExchangedProductId(exchangeProduct.getId());
        returnRecord.setExchangedProductQuantity(exchangeQty);
        returnRecord.setExchangeNewInvoiceId(newInvoice.getId());
        returnRecord.setExchangeNewInvoiceNumber(newInvoiceNumber);
        returnRecord.setProcessedBy(org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName());
        returnRecord.setStatus("RESOLVED_EXCHANGE");
        productReturnRepository.save(returnRecord);

        originalInvoice.setStatus(Invoice.InvoiceStatus.EXCHANGED);
        invoiceRepository.save(originalInvoice);

        auditLogRepository.save(AuditLog.builder()
                .ownerId(admin.getId())
                .branchId(branchId)
                .productId(exchangeProduct.getId())
                .action("STOCK_REDUCED")
                .productName(exchangeProduct.getName())
                .quantity(exchangeQty)
                .userEmail(returnRecord.getProcessedBy())
                .build());

        auditLogRepository.save(AuditLog.builder()
                .ownerId(admin.getId())
                .branchId(branchId)
                .productId(returnedProduct.getId())
                .action("RETURN")
                .productName(returnedProduct.getName())
                .quantity(returnRecord.getQuantity())
                .userEmail(returnRecord.getProcessedBy())
                .build());

        Map<String, Object> res = new HashMap<>();
        res.put("id", returnId);
        res.put("newInvoiceNumber", newInvoiceNumber);
        res.put("priceDifference", priceDifference);
        res.put("status", "RESOLVED_EXCHANGE");
        return ApiResponse.success("Exchange processed successfully.", res);
    }
}
