package com.smartinventory.service;

import com.smartinventory.entity.*;
import com.smartinventory.repository.*;
import com.smartinventory.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupplierDispatchService {

    private final SupplierDispatchRepository supplierDispatchRepository;
    private final SupplierProductRepository supplierProductRepository;
    private final AdminRepository adminRepository;
    private final ProductRepository productRepository;
    private final ProductBatchRepository productBatchRepository;
    private final AuditLogRepository auditLogRepository;
    private final NotificationService notificationService;
    private final com.smartinventory.util.SecurityUtils securityUtils;
    private final BranchRepository branchRepository;

    @Transactional
    public SupplierDispatch dispatchProduct(Long supplierProductId, Long adminId, Long branchId, Integer quantity) {
        Supplier supplier = (Supplier) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        SupplierProduct sp = supplierProductRepository.findById(supplierProductId)
                .orElseThrow(() -> new RuntimeException("Supplier product not found"));

        if (!sp.getSupplier().getId().equals(supplier.getId())) {
            throw new RuntimeException("Access denied: Not your product");
        }

        if (sp.getAvailableStock() < quantity) {
            throw new RuntimeException("Insufficient available stock. Available: " + sp.getAvailableStock());
        }

        Admin admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("Owner not found"));

        Branch branch = null;
        if (branchId != null) {
            branch = branchRepository.findByIdAndAdminId(branchId, adminId).orElse(null);
        }

        // Deduct available, increase reserved
        sp.setAvailableStock(sp.getAvailableStock() - quantity);
        sp.setReservedStock(sp.getReservedStock() + quantity);
        supplierProductRepository.save(sp);

        SupplierDispatch dispatch = SupplierDispatch.builder()
                .supplier(supplier)
                .admin(admin)
                .branch(branch)
                .supplierProduct(sp)
                .quantity(quantity)
                .status("PENDING")
                .build();

        SupplierDispatch saved = supplierDispatchRepository.save(dispatch);

        // Audit Log
        AuditLog audit = AuditLog.builder()
                .ownerId(admin.getId())
                .branchId(branch != null ? branch.getId() : null)
                .action("DISPATCH")
                .productName(sp.getName())
                .quantity(quantity)
                .userEmail(supplier.getEmail())
                .build();
        auditLogRepository.save(audit);

        return saved;
    }

    @Transactional
    public SupplierDispatch acceptDispatch(Long dispatchId) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String userEmail = "";
        if (principal instanceof Admin) {
            userEmail = ((Admin) principal).getEmail();
        } else if (principal instanceof Staff) {
            userEmail = ((Staff) principal).getEmail();
        } else {
            throw new RuntimeException("Only owners or staff can accept delivery");
        }

        SupplierDispatch dispatch = supplierDispatchRepository.findById(dispatchId)
                .orElseThrow(() -> new RuntimeException("Dispatch record not found"));

        if (!dispatch.getStatus().equals("PENDING")) {
            throw new RuntimeException("Dispatch is already " + dispatch.getStatus());
        }

        dispatch.setStatus("ACCEPTED");
        SupplierProduct sp = dispatch.getSupplierProduct();
        if (sp != null && (sp.getBarcodeNumber() == null || sp.getBarcodeNumber().isBlank())) {
            String generatedBarcode = "99" + String.format("%011d", (long) (Math.random() * 100000000000L));
            sp.setBarcodeNumber(generatedBarcode);
            supplierProductRepository.save(sp);
            log.info("Generated fallback barcode '{}' for supplier product '{}' during dispatch receipt", generatedBarcode, sp.getName());
        }

        // Release from reserved stock
        sp.setReservedStock(Math.max(0, sp.getReservedStock() - dispatch.getQuantity()));
        sp.setTotalStock(sp.getAvailableStock() + sp.getReservedStock() + sp.getDamagedStock());
        supplierProductRepository.save(sp);

        // Add to owner's inventory
        Admin admin = adminRepository.findById(dispatch.getAdmin().getId())
                .orElseThrow(() -> new RuntimeException("Admin not found"));

        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            throw new RuntimeException("Branch selection is required");
        }
        Branch activeBranch = branchRepository.findByIdAndAdminId(branchId, admin.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + branchId));

        if (dispatch.getBranch() != null && !dispatch.getBranch().getId().equals(branchId)) {
            throw new RuntimeException("Access denied: This delivery belongs to branch " + dispatch.getBranch().getName());
        }
        if (dispatch.getBranch() == null) {
            dispatch.setBranch(activeBranch);
            log.info("Assigned legacy dispatch {} to branch {} before receiving stock", dispatch.getId(), branchId);
        }

        Product ownerProduct = null;
        if (sp.getBarcodeNumber() != null && !sp.getBarcodeNumber().isBlank()) {
            ownerProduct = productRepository.findByBarcodeAndAdminAndBranchId(sp.getBarcodeNumber(), admin, branchId)
                    .orElse(null);
        }
        if (ownerProduct == null && (sp.getBarcodeNumber() == null || sp.getBarcodeNumber().isBlank())) {
            ownerProduct = productRepository.findByAdminIdAndBranchIdAndNameIgnoreCase(admin.getId(), branchId, sp.getName())
                    .orElse(null);
        }

        if (ownerProduct == null) {
            // Create a brand new product
            ownerProduct = Product.builder()
                    .admin(admin)
                    .branch(activeBranch)
                    .name(sp.getName())
                    .category(sp.getCategory())
                    .barcode(sp.getBarcodeNumber())
                    .purchasePrice(sp.getUnitPrice())
                    .sellingPrice(sp.getUnitPrice().multiply(BigDecimal.valueOf(1.15))) // Default 15% markup
                    .currentStock(dispatch.getQuantity())
                    .openingStock(dispatch.getQuantity())
                    .minimumStockAlert(5)
                    .status("Active")
                    .build();
        } else {
            ownerProduct.setCurrentStock(ownerProduct.getCurrentStock() + dispatch.getQuantity());
            ownerProduct.setPurchasePrice(sp.getUnitPrice());
            ownerProduct.setStatus("Active");
            if (sp.getBarcodeNumber() != null && !sp.getBarcodeNumber().isBlank()) {
                ownerProduct.setBarcode(sp.getBarcodeNumber());
            }
        }
        if (ownerProduct.getBarcode() == null || ownerProduct.getBarcode().isBlank()) {
            throw new IllegalStateException("Product barcode cannot be null");
        }
        productRepository.save(ownerProduct);

        // Verify product barcode is not null after saving
        Product savedProd = productRepository.findById(ownerProduct.getId()).orElse(null);
        if (savedProd != null && (savedProd.getBarcode() == null || savedProd.getBarcode().isBlank())) {
            throw new IllegalStateException("Verification failed: Product barcode is still null or blank after save");
        }

        // Create a batch
        ProductBatch batch = ProductBatch.builder()
                .product(ownerProduct)
                .admin(admin)
                .branch(activeBranch)
                .batchNumber("DISP-" + dispatch.getId() + "-" + System.currentTimeMillis() % 10000)
                .barcode(sp.getBarcodeNumber())
                .manufacturingDate(sp.getManufacturingDate())
                .expiryDate(sp.getExpiryDate())
                .purchasePrice(sp.getUnitPrice())
                .sellingPrice(ownerProduct.getSellingPrice())
                .quantityReceived(dispatch.getQuantity())
                .quantityRemaining(dispatch.getQuantity())
                .build();
        productBatchRepository.save(batch);
        log.info("Received supplier barcode '{}' for owner {} branch {} product {}", sp.getBarcodeNumber(), admin.getId(), branchId, ownerProduct.getId());

        SupplierDispatch saved = supplierDispatchRepository.save(dispatch);

        // Audit Log
        AuditLog audit = AuditLog.builder()
                .ownerId(admin.getId())
                .branchId(dispatch.getBranch() != null ? dispatch.getBranch().getId() : null)
                .productId(ownerProduct.getId())
                .action("RECEIVED")
                .productName(sp.getName())
                .quantity(dispatch.getQuantity())
                .userEmail(userEmail)
                .build();
        auditLogRepository.save(audit);

        // Notify Supplier
        notificationService.createNotification(
                -dispatch.getSupplier().getId(),
                "DISPATCH_ACCEPTED",
                "Owner accepted dispatch of " + dispatch.getQuantity() + " units of " + sp.getName(),
                "SUPPLIER_DISPATCH",
                dispatch.getId()
        );

        return saved;
    }

    @Transactional
    public SupplierDispatch rejectDispatch(Long dispatchId, String reason) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String userEmail = "";
        if (principal instanceof Admin) {
            userEmail = ((Admin) principal).getEmail();
        } else if (principal instanceof Staff) {
            userEmail = ((Staff) principal).getEmail();
        } else {
            throw new RuntimeException("Only owners or staff can reject delivery");
        }

        SupplierDispatch dispatch = supplierDispatchRepository.findById(dispatchId)
                .orElseThrow(() -> new RuntimeException("Dispatch record not found"));

        if (!dispatch.getStatus().equals("PENDING")) {
            throw new RuntimeException("Dispatch is already " + dispatch.getStatus());
        }

        dispatch.setStatus("REJECTED");
        dispatch.setRejectionReason(reason);
        dispatch.setRejectionDate(LocalDateTime.now());

        SupplierProduct sp = dispatch.getSupplierProduct();

        // Release from reserved stock back to available stock
        sp.setReservedStock(Math.max(0, sp.getReservedStock() - dispatch.getQuantity()));
        sp.setAvailableStock(sp.getAvailableStock() + dispatch.getQuantity());
        sp.setTotalStock(sp.getAvailableStock() + sp.getReservedStock() + sp.getDamagedStock());
        supplierProductRepository.save(sp);

        SupplierDispatch saved = supplierDispatchRepository.save(dispatch);

        AuditLog audit = AuditLog.builder()
                .ownerId(dispatch.getAdmin().getId())
                .branchId(dispatch.getBranch() != null ? dispatch.getBranch().getId() : null)
                .action("REJECT")
                .productName(sp.getName())
                .quantity(dispatch.getQuantity())
                .userEmail(userEmail)
                .build();
        auditLogRepository.save(audit);

        // Notify Supplier
        notificationService.createNotification(
                -dispatch.getSupplier().getId(),
                "DISPATCH_REJECTED",
                "Owner rejected dispatch of " + dispatch.getQuantity() + " units of " + sp.getName() + ". Reason: " + reason,
                "SUPPLIER_DISPATCH",
                dispatch.getId()
        );

        return saved;
    }

    public List<SupplierDispatch> getSupplierDispatches() {
        Supplier supplier = (Supplier) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return supplierDispatchRepository.findAllBySupplierOrderByDispatchDateDesc(supplier);
    }

    public List<SupplierDispatch> getOwnerDispatches() {
        Admin admin = null;
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof Admin) {
            admin = (Admin) principal;
        } else if (principal instanceof Staff) {
            admin = ((Staff) principal).getAdmin();
        } else {
            throw new RuntimeException("Access denied");
        }
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            throw new RuntimeException("Branch selection is required");
        }
        Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId()).orElse(null);
        return supplierDispatchRepository.findAllByAdminAndBranchOrderByDispatchDateDesc(admin, branch);
    }
}
