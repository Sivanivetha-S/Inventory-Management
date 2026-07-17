package com.smartinventory.service;

import com.smartinventory.dto.request.ProductBatchRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.ProductBatchResponse;
import com.smartinventory.email.EmailService;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Product;
import com.smartinventory.entity.Branch;
import com.smartinventory.entity.ProductBatch;
import com.smartinventory.entity.Staff;
import com.smartinventory.entity.AuditLog;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.ProductBatchRepository;
import com.smartinventory.repository.ProductRepository;
import com.smartinventory.repository.StaffRepository;
import com.smartinventory.repository.BranchRepository;
import com.smartinventory.repository.AuditLogRepository;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductBatchService {

    private final ProductBatchRepository batchRepository;
    private final ProductRepository productRepository;
    private final StaffRepository staffRepository;
    private final BranchRepository branchRepository;
    private final AuditLogRepository auditLogRepository;
    private final SecurityUtils securityUtils;
    private final EmailService emailService;
    private final NotificationService notificationService;

    // ── Helpers ───────────────────────────────────────────────────────────────
    private Admin currentAdmin() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof Admin a) return a;
        // Staff can also receive batches — look up their admin
        if (principal instanceof Staff s) return s.getAdmin();
        throw new RuntimeException("Unauthorized");
    }

    private Staff currentStaffOrNull() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return principal instanceof Staff s ? s : null;
    }

    // ── Add a new batch (receive stock) ───────────────────────────────────────
    @Transactional
    public ApiResponse<ProductBatchResponse> addBatch(ProductBatchRequest request) {
        Admin admin = currentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) throw new RuntimeException("Branch selection is required");
        Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Branch", branchId));

        Product product;

        // 1. Try to resolve product by explicit ID first
        if (request.getProductId() != null) {
            product = productRepository.findByIdAndAdminIdAndBranchId(request.getProductId(), admin.getId(), branchId)
                    .orElseThrow(() -> new RuntimeException("Product not found"));
        }
        // 2. Try by barcode
        else if (request.getBarcode() != null && !request.getBarcode().isBlank()) {
            product = productRepository.findByBarcodeAndAdminAndBranchId(request.getBarcode(), admin, branchId)
                    .orElse(null);
            if (product == null) {
                // Barcode not found → create new Product Master entry
                if (request.getProductName() == null || request.getProductName().isBlank()) {
                    throw new RuntimeException(
                            "Barcode not found. Please provide product name and category to register it.");
                }
                product = Product.builder()
                        .admin(admin)
                        .branch(branch)
                        .name(request.getProductName())
                        .category(request.getCategory() != null ? request.getCategory() : "General")
                        .barcode(request.getBarcode())
                        .purchasePrice(request.getPurchasePrice())
                        .sellingPrice(request.getSellingPrice())
                        .currentStock(0)
                        .openingStock(0)
                        .build();
                productRepository.save(product);
            }
        } else {
            throw new RuntimeException("Either productId or barcode must be provided");
        }

        // 3. Resolve staff if provided
        Staff staff = null;
        if (request.getStaffId() != null) {
            staff = staffRepository.findById(request.getStaffId()).orElse(null);
        } else {
            staff = currentStaffOrNull();
        }

        // Validation & Transformation for Dates based on Category
        String category = product.getCategory() != null ? product.getCategory().trim().toLowerCase() : "";
        LocalDate mfd = request.getManufacturingDate();
        LocalDate exp = request.getExpiryDate();

        // 1. Categories that do NOT require MFD/Expiry: nullify them
        java.util.List<String> noDateCats = java.util.List.of(
            "dress", "clothing", "boxes", "plastic products", "stationery", "furniture",
            "dresses", "box", "plastic"
        );
        if (noDateCats.contains(category)) {
            mfd = null;
            exp = null;
        } else {
            // 2. Categories that REQUIRE MFD/Expiry
            java.util.List<String> requiredDateCats = java.util.List.of(
                "medicines", "medicine", "food", "beverages", "beverage", "cosmetics", "cosmetic",
                "dairy products", "dairy", "bakery products", "bakery"
            );
            if (requiredDateCats.contains(category)) {
                if (mfd == null || exp == null) {
                    throw new RuntimeException("Manufacturing Date and Expiry Date are mandatory for category: " + product.getCategory());
                }
            }

            // 3. Expiry date comparison validation
            if (mfd != null && exp != null) {
                if (!exp.isAfter(mfd)) {
                    throw new RuntimeException("Expiry Date must be later than Manufacturing Date.");
                }
            }
        }

        // 4. Build and save batch
        ProductBatch batch = ProductBatch.builder()
                .product(product)
                .admin(admin)
                .branch(branch)
                .receivedByStaff(staff)
                .batchNumber(request.getBatchNumber())
                .barcode(request.getBarcode() != null ? request.getBarcode() : product.getBarcode())
                .manufacturingDate(mfd)
                .expiryDate(exp)
                .purchasePrice(request.getPurchasePrice())
                .sellingPrice(request.getSellingPrice())
                .quantityReceived(request.getQuantity())
                .quantityRemaining(request.getQuantity())
                .build();
        batchRepository.save(batch);

        // 5. Update Product.currentStock
        product.setCurrentStock(product.getCurrentStock() + request.getQuantity());
        product.setPurchasePrice(request.getPurchasePrice());
        product.setSellingPrice(request.getSellingPrice());
        productRepository.save(product);

        // 6. Log Stock Added Action to AuditLog
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogRepository.save(AuditLog.builder()
                .ownerId(admin.getId())
                .branchId(branch != null ? branch.getId() : null)
                .productId(product.getId())
                .action("STOCK_ADDED")
                .productName(product.getName())
                .quantity(request.getQuantity())
                .userEmail(email)
                .build());

        // 7. Notify admin by email if stock was added by staff
        if (staff != null) {
            final String staffName = staff.getFullName();
            final Product finalProduct = product;
            try {
                emailService.sendStockReceivedEmail(
                        admin.getEmail(), admin.getFullName(), staffName,
                        finalProduct.getName(), request.getQuantity(), request.getBatchNumber());
            } catch (Exception ignored) {}
        }

        // 8. Persist MongoDB notification
        notificationService.createNotification(
                admin.getId(), branch != null ? branch.getId() : null, "STOCK_RECEIVED",
                "New stock added: " + product.getName() + " | Batch: " + request.getBatchNumber()
                        + " | Qty: " + request.getQuantity(),
                "PRODUCT", batch.getId());

        return ApiResponse.success("Batch added and stock updated", ProductBatchResponse.from(batch));
    }

    // ── Get all batches ───────────────────────────────────────────────────────
    public ApiResponse<List<ProductBatchResponse>> getAllBatches() {
        Admin admin = currentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) throw new RuntimeException("Branch selection is required");
        branchRepository.findByIdAndAdminId(branchId, admin.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Branch", branchId));
        List<ProductBatchResponse> list = batchRepository.findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(admin.getId(), branchId)
                .stream().map(ProductBatchResponse::from).collect(Collectors.toList());
        return ApiResponse.success("Batches retrieved", list);
    }

    // ── Get batches for a specific product ────────────────────────────────────
    public ApiResponse<List<ProductBatchResponse>> getBatchesByProduct(Long productId) {
        Admin admin = currentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) throw new RuntimeException("Branch selection is required");
        Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Branch", branchId));
        Product product = productRepository.findByIdAndAdminIdAndBranchId(productId, admin.getId(), branchId)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        List<ProductBatchResponse> list =
                batchRepository.findAllByProductAndAdminAndBranch(product, admin, branch)
                        .stream().map(ProductBatchResponse::from).collect(Collectors.toList());
        return ApiResponse.success("Product batches retrieved", list);
    }

    // ── Look up product by barcode ────────────────────────────────────────────
    public ApiResponse<ProductBatchResponse> lookupByBarcode(String barcode) {
        Admin admin = currentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) throw new RuntimeException("Branch selection is required");
        Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Branch", branchId));
        // Return the latest active batch for this barcode
        List<ProductBatch> batches = batchRepository.findAllByBarcodeAndAdminAndBranch(barcode, admin, branch);
        if (batches.isEmpty()) return ApiResponse.success("Barcode not found — new product", null);
        ProductBatch latest = batches.get(batches.size() - 1);
        return ApiResponse.success("Product found", ProductBatchResponse.from(latest));
    }
}
