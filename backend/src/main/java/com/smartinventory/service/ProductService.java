package com.smartinventory.service;

import com.smartinventory.dto.request.ProductRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.ProductResponse;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Branch;
import com.smartinventory.entity.Product;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.BranchRepository;
import com.smartinventory.repository.ProductRepository;
import com.smartinventory.repository.AuditLogRepository;
import com.smartinventory.entity.AuditLog;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final BranchRepository branchRepository;
    private final AuditLogRepository auditLogRepository;
    private final SecurityUtils securityUtils;

    public ApiResponse<List<ProductResponse>> getAllProducts() {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<Product> list = productRepository.findByAdminIdAndBranchId(adminId, branchId);
        List<ProductResponse> products = list
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Products retrieved", products);
    }

    public ApiResponse<ProductResponse> getProductById(Long id) {
        Product product = findByIdAndAdmin(id);
        return ApiResponse.success("Product retrieved", mapToResponse(product));
    }

    public ApiResponse<List<ProductResponse>> getSupplierCatalog() {
        List<ProductResponse> products = productRepository.findBySupplierIsNotNull()
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Supplier products retrieved", products);
    }

    @Transactional
    public ApiResponse<ProductResponse> createProduct(ProductRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(admin.getId());
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        Branch branch = null;
        if (branchId != null) {
            branch = branchRepository.findByIdAndAdminId(branchId, admin.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Branch", branchId));
        }

        Product product = Product.builder()
                .admin(admin)
                .branch(branch)
                .name(request.getName())
                .category(request.getCategory())
                .purchasePrice(request.getPurchasePrice())
                .sellingPrice(request.getSellingPrice())
                .currentStock(request.getCurrentStock())
                .openingStock(request.getCurrentStock())
                .minimumStockAlert(request.getMinimumStockAlert())
                .build();
        product = productRepository.save(product);

        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogRepository.save(AuditLog.builder()
                .ownerId(admin.getId())
                .branchId(branch != null ? branch.getId() : null)
                .productId(product.getId())
                .action("PRODUCT_ADDED")
                .productName(product.getName())
                .quantity(product.getCurrentStock())
                .userEmail(email)
                .build());

        return ApiResponse.success("Product created successfully", mapToResponse(product));
    }

    @Transactional
    public ApiResponse<ProductResponse> updateProduct(Long id, ProductRequest request) {
        Product product = findByIdAndAdmin(id);
        int oldStock = product.getCurrentStock();
        int newStock = request.getCurrentStock();

        product.setName(request.getName());
        product.setCategory(request.getCategory());
        product.setPurchasePrice(request.getPurchasePrice());
        product.setSellingPrice(request.getSellingPrice());
        product.setCurrentStock(newStock);
        product.setMinimumStockAlert(request.getMinimumStockAlert());
        product = productRepository.save(product);

        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogRepository.save(AuditLog.builder()
                .ownerId(product.getAdmin().getId())
                .branchId(product.getBranch() != null ? product.getBranch().getId() : null)
                .productId(product.getId())
                .action("PRODUCT_UPDATED")
                .productName(product.getName())
                .quantity(newStock)
                .userEmail(email)
                .build());

        if (newStock != oldStock) {
            String stockAction = newStock > oldStock ? "STOCK_ADDED" : "STOCK_REDUCED";
            auditLogRepository.save(AuditLog.builder()
                    .ownerId(product.getAdmin().getId())
                    .branchId(product.getBranch() != null ? product.getBranch().getId() : null)
                    .productId(product.getId())
                    .action(stockAction)
                    .productName(product.getName())
                    .quantity(Math.abs(newStock - oldStock))
                    .userEmail(email)
                    .build());
        }

        return ApiResponse.success("Product updated successfully", mapToResponse(product));
    }

    @Transactional
    public ApiResponse<String> deleteProduct(Long id) {
        Product product = findByIdAndAdmin(id);
        productRepository.delete(product);

        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogRepository.save(AuditLog.builder()
                .ownerId(product.getAdmin().getId())
                .branchId(product.getBranch() != null ? product.getBranch().getId() : null)
                .productId(product.getId())
                .action("PRODUCT_DELETED")
                .productName(product.getName())
                .quantity(product.getCurrentStock())
                .userEmail(email)
                .build());

        return ApiResponse.success("Product deleted successfully");
    }

    public ApiResponse<List<ProductResponse>> getLowStockProducts() {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<ProductResponse> products = productRepository.findLowStockByAdminIdAndBranchId(adminId, branchId)
                .stream()
                .map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Low stock products retrieved", products);
    }

    public ApiResponse<List<ProductResponse>> searchProducts(String search) {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<ProductResponse> products = productRepository.searchByAdminIdAndBranchId(adminId, branchId, search)
                .stream()
                .map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Search results", products);
    }

    public ApiResponse<List<String>> getCategories() {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<String> categories = productRepository.findDistinctCategoriesByAdminIdAndBranchId(adminId, branchId);
        return ApiResponse.success("Categories retrieved", categories);
    }

    // Used internally (no admin check — called from InvoiceService after verifying ownership)
    public Product findById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }

    // Used for all admin-scoped operations
    public Product findByIdAndAdmin(Long id) {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        Product product = productRepository.findByIdAndAdminIdAndBranchId(id, adminId, branchId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
        if (branchId != null && product.getBranch() != null && !product.getBranch().getId().equals(branchId)) {
            throw new RuntimeException("Access denied: Product belongs to another branch.");
        }
        return product;
    }

    public ProductResponse mapToResponse(Product product) {
        return ProductResponse.builder()
                .id(product.getId())
                .name(product.getName())
                .category(product.getCategory())
                .barcode(product.getBarcode())
                .riskLevel(product.getRiskLevel() == null ? "LOW" : product.getRiskLevel().name())
                .purchasePrice(product.getPurchasePrice())
                .sellingPrice(product.getSellingPrice())
                .currentStock(product.getCurrentStock())
                .minimumStockAlert(product.getMinimumStockAlert())
                .openingStock(product.getOpeningStock())
                .lowStock(product.isLowStock())
                .branchId(product.getBranch() != null ? product.getBranch().getId() : null)
                .branchName(product.getBranch() != null ? product.getBranch().getName() : null)
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }
}
