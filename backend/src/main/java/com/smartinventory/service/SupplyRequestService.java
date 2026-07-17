package com.smartinventory.service;

import com.smartinventory.dto.request.SupplyRequestCreateRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.SupplyRequestResponse;
import com.smartinventory.email.EmailService;
import com.smartinventory.entity.*;
import com.smartinventory.repository.*;
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
public class SupplyRequestService {

    private final SupplyRequestRepository supplyRequestRepository;
    private final SupplierRepository      supplierRepository;
    private final ProductRepository       productRepository;
    private final AdminRepository         adminRepository;
    private final StaffRepository         staffRepository;
    private final EmailService            emailService;
    private final NotificationService     notificationService;
    private final ProductBatchRepository  productBatchRepository;
    private final SupplierProductRepository supplierProductRepository;
    private final BranchRepository branchRepository;
    private final com.smartinventory.util.SecurityUtils securityUtils;

    // ── Create supply request ─────────────────────────────────────────────────
    @Transactional
    public ApiResponse<SupplyRequestResponse> createRequest(SupplyRequestCreateRequest req) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        org.springframework.security.core.Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        Admin    admin    = null;
        Supplier supplier = null;

        boolean isSupplier = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPPLIER"));
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        boolean isStaff = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().startsWith("ROLE_") && !a.getAuthority().equals("ROLE_ADMIN") && !a.getAuthority().equals("ROLE_SUPPLIER"));

        if (isSupplier) {
            supplier = supplierRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Supplier profile not found"));
            if (req.getAdminId() == null)
                throw new RuntimeException("Please select a shop owner");
            admin = adminRepository.findById(req.getAdminId())
                    .orElseThrow(() -> new RuntimeException("Shop owner not found"));
            req.setDirection("SUPPLIER_TO_OWNER");
        } else if (isAdmin) {
            admin = adminRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Admin profile not found"));
            if (req.getSupplierId() == null)
                throw new RuntimeException("Please select a supplier");
            supplier = supplierRepository.findById(req.getSupplierId())
                    .orElseThrow(() -> new RuntimeException("Supplier not found"));
            req.setDirection("OWNER_TO_SUPPLIER");
        } else if (isStaff) {
            Staff staff = staffRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Staff profile not found"));
            admin = staff.getAdmin();
            if (req.getSupplierId() == null)
                throw new RuntimeException("Please select a supplier");
            supplier = supplierRepository.findById(req.getSupplierId())
                    .orElseThrow(() -> new RuntimeException("Supplier not found"));
            req.setDirection("OWNER_TO_SUPPLIER");
        } else {
            throw new RuntimeException("Access denied: only owners and suppliers can create supply requests");
        }

        Product product = null;
        if (req.getProductId() != null) {
            product = productRepository.findById(req.getProductId()).orElse(null);
        }

        SupplierProduct supplierProduct = null;
        if (req.getSupplierProductId() != null) {
            supplierProduct = supplierProductRepository.findById(req.getSupplierProductId()).orElse(null);
        }

        Branch branch = null;
        if (req.getBranchId() != null) {
            branch = branchRepository.findByIdAndAdminId(req.getBranchId(), admin.getId())
                    .orElseThrow(() -> new RuntimeException("Branch not found for selected owner"));
        } else {
            Long activeBranchId = securityUtils.getCurrentBranchId();
            if (activeBranchId != null) {
                branch = branchRepository.findByIdAndAdminId(activeBranchId, admin.getId()).orElse(null);
            }
            if (branch == null) {
                List<Branch> branches = branchRepository.findAllByAdminId(admin.getId());
                if (!branches.isEmpty()) {
                    branch = branches.get(0);
                }
            }
        }
        if (branch == null) {
            throw new RuntimeException("A destination branch is required for this supply request");
        }

        SupplyRequest.RequestDirection direction =
                SupplyRequest.RequestDirection.valueOf(req.getDirection());

        SupplyRequest request = SupplyRequest.builder()
                .admin(admin)
                .branch(branch)
                .supplier(supplier)
                .product(product)
                .supplierProduct(supplierProduct)
                .productName(req.getProductName())
                .quantity(req.getQuantity())
                .unitPrice(req.getUnitPrice())
                .direction(direction)
                .notes(req.getNotes())
                .unit(req.getUnit())
                .unitSize(req.getUnitSize())
                .status(SupplyRequest.RequestStatus.PENDING)
                .build();

        supplyRequestRepository.save(request);

        // Email notification
        try {
            String dirLabel = direction == SupplyRequest.RequestDirection.OWNER_TO_SUPPLIER
                    ? "Owner → Supplier" : "Supplier → Owner";
            emailService.sendSupplyRequestEmail(
                    direction == SupplyRequest.RequestDirection.OWNER_TO_SUPPLIER
                            ? supplier.getEmail() : admin.getEmail(),
                    direction == SupplyRequest.RequestDirection.OWNER_TO_SUPPLIER
                            ? supplier.getSupplierName() : admin.getFullName(),
                    admin.getShopName(),
                    req.getProductName(), req.getQuantity(), dirLabel);
        } catch (Exception e) {
            log.warn("Supply request email failed: {}", e.getMessage());
        }

        // MongoDB notification
        notificationService.createNotification(admin.getId(), branch != null ? branch.getId() : null, "SUPPLY_REQUEST",
                (direction == SupplyRequest.RequestDirection.OWNER_TO_SUPPLIER
                        ? "Supply request sent to " : "Supply request received from ")
                        + supplier.getCompanyName()
                        + " for " + req.getProductName() + " × " + req.getQuantity(),
                "SUPPLY_REQUEST", request.getId());

        return ApiResponse.success("Supply request created", SupplyRequestResponse.from(request));
    }

    // ── Get all requests for current authenticated user ────────────────────────
    public ApiResponse<List<SupplyRequestResponse>> getMyRequests() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        org.springframework.security.core.Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        boolean isSupplier = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPPLIER"));
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        boolean isStaff = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().startsWith("ROLE_") && !a.getAuthority().equals("ROLE_ADMIN") && !a.getAuthority().equals("ROLE_SUPPLIER"));

        if (isSupplier) {
            Supplier supplier = supplierRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Supplier profile not found"));
            return ApiResponse.success("Requests retrieved",
                    supplyRequestRepository.findAllBySupplierOrderByCreatedAtDesc(supplier)
                            .stream().map(SupplyRequestResponse::from).collect(Collectors.toList()));
        } else if (isAdmin) {
            Admin admin = adminRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Admin profile not found"));
            Long branchId = securityUtils.getCurrentBranchId();
            if (branchId == null) {
                throw new RuntimeException("Branch selection is required");
            }
            Branch branch = branchRepository.findByIdAndAdminId(branchId, admin.getId()).orElse(null);
            List<SupplyRequestResponse> list = supplyRequestRepository.findAllByAdminAndBranchOrderByCreatedAtDesc(admin, branch)
                    .stream()
                    .map(SupplyRequestResponse::from)
                    .collect(Collectors.toList());
            return ApiResponse.success("Requests retrieved", list);
        } else if (isStaff) {
            Staff staff = staffRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Staff profile not found"));
            Long branchId = securityUtils.getCurrentBranchId();
            if (branchId == null) {
                throw new RuntimeException("Branch selection is required");
            }
            Branch branch = branchRepository.findByIdAndAdminId(branchId, staff.getAdmin().getId()).orElse(null);
            List<SupplyRequestResponse> list = supplyRequestRepository.findAllByAdminAndBranchOrderByCreatedAtDesc(staff.getAdmin(), branch)
                    .stream()
                    .map(SupplyRequestResponse::from)
                    .collect(Collectors.toList());
            return ApiResponse.success("Requests retrieved", list);
        }

        throw new RuntimeException("Access denied");
    }

    // ── Update request status ─────────────────────────────────────────────────
    @Transactional
    public ApiResponse<SupplyRequestResponse> updateStatus(Long id, String status, String notes) {
        SupplyRequest request = supplyRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Supply request not found"));
        SupplyRequest.RequestStatus nextStatus =
                SupplyRequest.RequestStatus.valueOf(status.toUpperCase());

        assertStatusChangeAllowed(request, nextStatus);

        SupplyRequest.RequestStatus prevStatus = request.getStatus();

        request.setStatus(nextStatus);
        request.setRespondedAt(LocalDateTime.now());
        if (notes != null && !notes.isBlank()) request.setNotes(notes);

        // Deduct supplier's product stock on DISPATCHED
        if (nextStatus == SupplyRequest.RequestStatus.DISPATCHED && prevStatus != SupplyRequest.RequestStatus.DISPATCHED) {
            deductSupplierStock(request);
        }

        // Revert supplier's product stock if cancelled/rejected after being dispatched
        if ((nextStatus == SupplyRequest.RequestStatus.CANCELLED || nextStatus == SupplyRequest.RequestStatus.REJECTED)
                && prevStatus == SupplyRequest.RequestStatus.DISPATCHED) {
            revertSupplierStock(request);
        }

        // When RECEIVED → auto-add stock to owner's product inventory
        if (nextStatus == SupplyRequest.RequestStatus.RECEIVED) {
            receiveIntoOwnerInventory(request);
        }

        supplyRequestRepository.save(request);

        // Notify owner when RECEIVED
        if (nextStatus == SupplyRequest.RequestStatus.RECEIVED) {
            notificationService.createNotification(
                    request.getAdmin().getId(), request.getBranch() != null ? request.getBranch().getId() : null, "INVENTORY_UPDATE",
                    "Stock received from " + request.getSupplier().getCompanyName()
                            + ". Inventory updated: " + request.getProductName()
                            + " +" + request.getQuantity(),
                    "INVENTORY", request.getId());
        }

        // Notify about status change
        notificationService.createNotification(
                request.getAdmin().getId(), request.getBranch() != null ? request.getBranch().getId() : null, "SUPPLY_REQUEST",
                "Supply request for " + request.getProductName() + " → " + nextStatus.name(),
                "SUPPLY_REQUEST", request.getId());

        // Email notification best-effort
        try {
            emailService.sendSupplyRequestEmail(
                    request.getSupplier().getEmail(),
                    request.getSupplier().getSupplierName(),
                    request.getAdmin().getShopName(),
                    request.getProductName(), request.getQuantity(),
                    "Status updated to: " + status);
        } catch (Exception e) {
            log.warn("Status update email failed: {}", e.getMessage());
        }

        return ApiResponse.success("Request status updated", SupplyRequestResponse.from(request));
    }

    // ── Get single ────────────────────────────────────────────────────────────
    public ApiResponse<SupplyRequestResponse> getById(Long id) {
        SupplyRequest r = supplyRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Supply request not found"));
        return ApiResponse.success("Request retrieved", SupplyRequestResponse.from(r));
    }

    // ── Status change permission check ────────────────────────────────────────
    private void assertStatusChangeAllowed(SupplyRequest req,
                                           SupplyRequest.RequestStatus next) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        boolean isOwner = false;
        boolean isSupplier = false;

        if (principal instanceof Admin) {
            isOwner = req.getAdmin().getId().equals(((Admin) principal).getId());
        } else if (principal instanceof Staff) {
            isOwner = req.getAdmin().getId().equals(((Staff) principal).getAdmin().getId());
        } else if (principal instanceof Supplier) {
            isSupplier = req.getSupplier().getId().equals(((Supplier) principal).getId());
        }

        boolean finalIsOwner = isOwner;

        switch (next) {
            case CANCELLED ->  {
                if (req.getDirection() == SupplyRequest.RequestDirection.OWNER_TO_SUPPLIER && isOwner) return;
                if (req.getDirection() == SupplyRequest.RequestDirection.SUPPLIER_TO_OWNER && isSupplier) return;
            }
            case ACCEPTED, REJECTED -> {
                // Supplier accepts owner's request; Owner accepts supplier's offer
                if (req.getDirection() == SupplyRequest.RequestDirection.OWNER_TO_SUPPLIER && isSupplier) return;
                if (req.getDirection() == SupplyRequest.RequestDirection.SUPPLIER_TO_OWNER && finalIsOwner) return;
            }
            case DISPATCHED -> { if (isSupplier) return; }
            case RECEIVED   -> { if (isOwner) return; }  // Owner-only
            default -> {}
        }

        throw new RuntimeException("You are not allowed to change this request to " + next);
    }


    // ── Receive stock into owner's product inventory ──────────────────────────
    @Transactional
    protected void receiveIntoOwnerInventory(SupplyRequest request) {
        Admin admin = request.getAdmin();

        if (request.getBranch() == null) {
            Long activeBranchId = securityUtils.getCurrentBranchId();
            if (activeBranchId == null) {
                throw new RuntimeException("Branch selection is required before receiving stock");
            }
            Branch activeBranch = branchRepository.findByIdAndAdminId(activeBranchId, admin.getId())
                    .orElseThrow(() -> new RuntimeException("Selected branch does not belong to this owner"));
            request.setBranch(activeBranch);
            supplyRequestRepository.save(request);
            log.info("Assigned legacy supply request {} to branch {} before receiving stock", request.getId(), activeBranchId);
        }

        // Deduct supplier's product stock is handled on DISPATCHED step.

        // 1. Check if the linked product already belongs to this admin (owner product)
        Product linkedProduct = request.getProduct();
        if (linkedProduct != null
                && linkedProduct.getAdmin() != null
                && linkedProduct.getAdmin().getId().equals(admin.getId())) {
            linkedProduct.setCurrentStock(linkedProduct.getCurrentStock() + request.getQuantity());
            if (request.getUnitPrice() != null)
                linkedProduct.setPurchasePrice(request.getUnitPrice());
            if (request.getSupplierProduct() != null && request.getSupplierProduct().getBarcodeNumber() != null) {
                linkedProduct.setBarcode(request.getSupplierProduct().getBarcodeNumber());
            }
            if (linkedProduct.getBarcode() == null || linkedProduct.getBarcode().isBlank()) {
                throw new IllegalStateException("Product barcode cannot be null");
            }
            productRepository.save(linkedProduct);
            createBatchForProduct(linkedProduct, request);
            log.info("✓ Stock added to existing owner product '{}' +{}",
                    linkedProduct.getName(), request.getQuantity());
            return;
        }

        Long branchId = request.getBranch() != null ? request.getBranch().getId() : null;

        // 2. Search by product name in THIS owner's catalog (case-insensitive)
        var byName = productRepository.findByAdminIdAndBranchIdAndNameIgnoreCase(
                admin.getId(), branchId, request.getProductName());
        if (byName.isPresent()) {
            Product p = byName.get();
            p.setCurrentStock(p.getCurrentStock() + request.getQuantity());
            if (request.getUnitPrice() != null) p.setPurchasePrice(request.getUnitPrice());
            if (request.getSupplierProduct() != null && request.getSupplierProduct().getBarcodeNumber() != null) {
                p.setBarcode(request.getSupplierProduct().getBarcodeNumber());
            }
            if (p.getBarcode() == null || p.getBarcode().isBlank()) {
                throw new IllegalStateException("Product barcode cannot be null");
            }
            productRepository.save(p);
            request.setProduct(p);
            supplyRequestRepository.save(request);
            createBatchForProduct(p, request);
            log.info("✓ Stock added to existing owner product by name '{}' +{}",
                    p.getName(), request.getQuantity());
            return;
        }

        // 3. Also try a fuzzy search (contains) as fallback
        List<Product> fuzzy = productRepository
                .searchByAdminIdAndBranchId(admin.getId(), branchId, request.getProductName())
                .stream()
                .filter(p -> p.getName().equalsIgnoreCase(request.getProductName()))
                .collect(Collectors.toList());
        if (!fuzzy.isEmpty()) {
            Product p = fuzzy.get(0);
            p.setCurrentStock(p.getCurrentStock() + request.getQuantity());
            if (request.getUnitPrice() != null) p.setPurchasePrice(request.getUnitPrice());
            if (request.getSupplierProduct() != null && request.getSupplierProduct().getBarcodeNumber() != null) {
                p.setBarcode(request.getSupplierProduct().getBarcodeNumber());
            }
            if (p.getBarcode() == null || p.getBarcode().isBlank()) {
                throw new IllegalStateException("Product barcode cannot be null");
            }
            productRepository.save(p);
            request.setProduct(p);
            supplyRequestRepository.save(request);
            createBatchForProduct(p, request);
            log.info("✓ Stock added to existing owner product (fuzzy match) '{}' +{}",
                    p.getName(), request.getQuantity());
            return;
        }

        // 4. Create a brand-new owner product from the supply request data
        // Use unit price as purchase price; selling price defaults to 10% markup or same as purchase
        BigDecimal purchasePrice = request.getUnitPrice() != null
                ? request.getUnitPrice()
                : BigDecimal.valueOf(1.00);

        BigDecimal sellingPrice = purchasePrice.multiply(BigDecimal.valueOf(1.10))
                .setScale(2, java.math.RoundingMode.HALF_UP);

        // Try to get category from the supplier product if linked
        String category = "Supplier";
        if (request.getSupplierProduct() != null && request.getSupplierProduct().getCategory() != null) {
            category = request.getSupplierProduct().getCategory();
        } else if (linkedProduct != null && linkedProduct.getCategory() != null) {
            category = linkedProduct.getCategory();
        }

        String barcode = null;
        if (request.getSupplierProduct() != null) {
            barcode = request.getSupplierProduct().getBarcodeNumber();
        } else if (linkedProduct != null) {
            barcode = linkedProduct.getBarcode();
        }

        if (barcode == null || barcode.isBlank()) {
            throw new IllegalStateException("Product barcode cannot be null when creating a new product from supply request");
        }

        Product newProduct = Product.builder()
                .admin(admin)
                .branch(request.getBranch()) // Set the branch context for the product!
                .supplier(null)              // belongs to OWNER, not supplier
                .name(request.getProductName())
                .category(category)
                .barcode(barcode)
                .purchasePrice(purchasePrice)
                .sellingPrice(sellingPrice)
                .currentStock(request.getQuantity())
                .openingStock(request.getQuantity())
                .minimumStockAlert(5)
                .status("Active")
                .build();

        productRepository.save(newProduct);

        // Verify product barcode is not null after saving
        Product savedProd = productRepository.findById(newProduct.getId()).orElse(null);
        if (savedProd != null && (savedProd.getBarcode() == null || savedProd.getBarcode().isBlank())) {
            throw new IllegalStateException("Verification failed: Product barcode is still null or blank after save");
        }

        request.setProduct(newProduct);
        supplyRequestRepository.save(request);
        createBatchForProduct(newProduct, request);
        log.info("✓ New owner product created from supply receipt: '{}' qty={}",
                newProduct.getName(), request.getQuantity());
    }

    // ── Create a ProductBatch record for traceability ─────────────────────────
    private void createBatchForProduct(Product product, SupplyRequest request) {
        try {
            BigDecimal purchasePrice = request.getUnitPrice() != null
                    ? request.getUnitPrice()
                    : (product.getPurchasePrice() != null
                            ? product.getPurchasePrice() : BigDecimal.ONE);
            BigDecimal sellingPrice = product.getSellingPrice() != null
                    ? product.getSellingPrice() : purchasePrice;

            ProductBatch batch = ProductBatch.builder()
                    .product(product)
                    .admin(request.getAdmin())
                    .branch(request.getBranch())
                    .batchNumber("SR-" + request.getId() + "-"
                            + System.currentTimeMillis() % 10000)
                    .barcode(product.getBarcode())
                    .purchasePrice(purchasePrice)
                    .sellingPrice(sellingPrice)
                    .quantityReceived(request.getQuantity())
                    .quantityRemaining(request.getQuantity())
                    .build();
            productBatchRepository.save(batch);
            log.info("✓ ProductBatch created for '{}'", product.getName());
        } catch (Exception e) {
            // Batch creation failure must NOT roll back the inventory update
            log.warn("ProductBatch creation failed (non-critical): {}", e.getMessage());
        }
    }

    @Transactional
    protected void deductSupplierStock(SupplyRequest request) {
        // Deduct supplier's product stock
        SupplierProduct sp = request.getSupplierProduct();
        if (sp == null) {
            var existingSp = supplierProductRepository
                    .findAllBySupplierOrderByCreatedAtDesc(request.getSupplier())
                    .stream()
                    .filter(p -> p.getName().equalsIgnoreCase(request.getProductName()))
                    .findFirst();
            if (existingSp.isPresent()) {
                sp = existingSp.get();
                request.setSupplierProduct(sp);
                supplyRequestRepository.save(request);
            }
        }

        if (sp == null) {
            String category = "General";
            if (request.getProduct() != null && request.getProduct().getCategory() != null) {
                category = request.getProduct().getCategory();
            }
            BigDecimal price = request.getUnitPrice() != null ? request.getUnitPrice() : BigDecimal.TEN;
            sp = SupplierProduct.builder()
                    .supplier(request.getSupplier())
                    .name(request.getProductName())
                    .category(category)
                    .unit(request.getUnit())
                    .unitSize(request.getUnitSize())
                    .availableStock(request.getQuantity())
                    .totalStock(request.getQuantity())
                    .reservedStock(0)
                    .purchasePrice(price)
                    .unitPrice(price)
                    .barcodeNumber("99" + String.format("%011d", (long) (Math.random() * 100000000000L)))
                    .build();
            sp = supplierProductRepository.save(sp);
            request.setSupplierProduct(sp);
            supplyRequestRepository.save(request);
        }

        if (sp.getBarcodeNumber() == null || sp.getBarcodeNumber().isBlank()) {
            String generatedBarcode = "99" + String.format("%011d", (long) (Math.random() * 100000000000L));
            sp.setBarcodeNumber(generatedBarcode);
            supplierProductRepository.save(sp);
            log.info("Generated fallback barcode '{}' for supplier product '{}' during supply request dispatch", generatedBarcode, sp.getName());
        }

        int newStock = sp.getAvailableStock() - request.getQuantity();
        sp.setAvailableStock(Math.max(0, newStock));
        supplierProductRepository.save(sp);
        log.info("✓ Supplier product '{}' stock decreased on dispatch: {} -{}", sp.getName(), sp.getAvailableStock(), request.getQuantity());
    }

    @Transactional
    protected void revertSupplierStock(SupplyRequest request) {
        SupplierProduct sp = request.getSupplierProduct();
        if (sp == null) {
            var existingSp = supplierProductRepository
                    .findAllBySupplierOrderByCreatedAtDesc(request.getSupplier())
                    .stream()
                    .filter(p -> p.getName().equalsIgnoreCase(request.getProductName()))
                    .findFirst();
            if (existingSp.isPresent()) {
                sp = existingSp.get();
                request.setSupplierProduct(sp);
                supplyRequestRepository.save(request);
            }
        }
        if (sp != null) {
            int newStock = sp.getAvailableStock() + request.getQuantity();
            sp.setAvailableStock(newStock);
            supplierProductRepository.save(sp);
            log.info("✓ Supplier product '{}' stock reverted (+{}): new available stock = {}", sp.getName(), request.getQuantity(), sp.getAvailableStock());
        }
    }
}
