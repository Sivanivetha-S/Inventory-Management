package com.smartinventory.service;

import com.smartinventory.dto.request.ProductRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.ProductResponse;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Product;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.ProductRepository;
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
    private final SecurityUtils securityUtils;

    public ApiResponse<List<ProductResponse>> getAllProducts() {
        Long adminId = securityUtils.getCurrentAdminId();
        List<ProductResponse> products = productRepository.findByAdminId(adminId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Products retrieved", products);
    }

    public ApiResponse<ProductResponse> getProductById(Long id) {
        Product product = findByIdAndAdmin(id);
        return ApiResponse.success("Product retrieved", mapToResponse(product));
    }

    @Transactional
    public ApiResponse<ProductResponse> createProduct(ProductRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();
        Product product = Product.builder()
                .admin(admin)
                .name(request.getName())
                .category(request.getCategory())
                .purchasePrice(request.getPurchasePrice())
                .sellingPrice(request.getSellingPrice())
                .currentStock(request.getCurrentStock())
                .openingStock(request.getCurrentStock())
                .minimumStockAlert(request.getMinimumStockAlert())
                .build();
        product = productRepository.save(product);
        return ApiResponse.success("Product created successfully", mapToResponse(product));
    }

    @Transactional
    public ApiResponse<ProductResponse> updateProduct(Long id, ProductRequest request) {
        Product product = findByIdAndAdmin(id);
        product.setName(request.getName());
        product.setCategory(request.getCategory());
        product.setPurchasePrice(request.getPurchasePrice());
        product.setSellingPrice(request.getSellingPrice());
        product.setCurrentStock(request.getCurrentStock());
        product.setMinimumStockAlert(request.getMinimumStockAlert());
        product = productRepository.save(product);
        return ApiResponse.success("Product updated successfully", mapToResponse(product));
    }

    @Transactional
    public ApiResponse<String> deleteProduct(Long id) {
        Product product = findByIdAndAdmin(id);
        productRepository.delete(product);
        return ApiResponse.success("Product deleted successfully");
    }

    public ApiResponse<List<ProductResponse>> getLowStockProducts() {
        Long adminId = securityUtils.getCurrentAdminId();
        List<ProductResponse> products = productRepository.findLowStockByAdminId(adminId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Low stock products retrieved", products);
    }

    public ApiResponse<List<ProductResponse>> searchProducts(String search) {
        Long adminId = securityUtils.getCurrentAdminId();
        List<ProductResponse> products = productRepository.searchByAdminId(adminId, search)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Search results", products);
    }

    public ApiResponse<List<String>> getCategories() {
        Long adminId = securityUtils.getCurrentAdminId();
        return ApiResponse.success("Categories retrieved",
                productRepository.findDistinctCategoriesByAdminId(adminId));
    }

    // Used internally (no admin check — called from InvoiceService after verifying ownership)
    public Product findById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }

    // Used for all admin-scoped operations
    public Product findByIdAndAdmin(Long id) {
        Long adminId = securityUtils.getCurrentAdminId();
        return productRepository.findByIdAndAdminId(id, adminId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }

    public ProductResponse mapToResponse(Product product) {
        return ProductResponse.builder()
                .id(product.getId())
                .name(product.getName())
                .category(product.getCategory())
                .purchasePrice(product.getPurchasePrice())
                .sellingPrice(product.getSellingPrice())
                .currentStock(product.getCurrentStock())
                .minimumStockAlert(product.getMinimumStockAlert())
                .openingStock(product.getOpeningStock())
                .lowStock(product.isLowStock())
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }
}
