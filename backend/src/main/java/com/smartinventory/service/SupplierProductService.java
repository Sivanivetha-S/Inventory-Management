package com.smartinventory.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.smartinventory.dto.request.SupplierProductRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.SupplierProductResponse;
import com.smartinventory.entity.Supplier;
import com.smartinventory.entity.SupplierProduct;
import com.smartinventory.repository.SupplierProductRepository;
import com.smartinventory.repository.SupplierRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.*;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SupplierProductService {

    private final SupplierProductRepository supplierProductRepository;
    private final SupplierRepository        supplierRepository;
    private final Validator                 validator;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    // Shared ObjectMapper with Java8 time support
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule());

    // ── Add product (with optional image) ────────────────────────────────────
    @Transactional
    public ApiResponse<SupplierProductResponse> addProduct(String dataJson,
                                                           MultipartFile image) {
        SupplierProductRequest req = parse(dataJson);
        if (req.getUnitPrice() == null && req.getSellingPrice() != null) {
            req.setUnitPrice(req.getSellingPrice());
        }
        if (req.getAvailableStock() == null && req.getQuantity() != null) {
            req.setAvailableStock(req.getQuantity());
        }
        validateRequest(req);
        validateUnitAndSize(req);
        validateDates(req);
        validatePrices(req);

        Supplier supplier = currentSupplier();
        validateSupplierProductConstraints(req, supplier, null);
        String imagePath  = saveImage(image, null);

        BigDecimal selling = resolveSelling(req);
        Integer    qty     = resolveQty(req);

        SupplierProduct sp = SupplierProduct.builder()
                .supplier(supplier)
                .name(req.getName())
                .category(req.getCategory())
                .brand(req.getBrand())
                .unit(req.getUnit())
                .unitSize(req.getUnitSize())
                .description(req.getDescription())
                .barcodeNumber(req.getBarcodeNumber())
                .productImage(imagePath)
                .manufacturingDate(req.getManufacturingDate())
                .expiryDate(req.getExpiryDate())
                .purchasePrice(req.getPurchasePrice())
                .sellingPrice(selling)
                .unitPrice(selling)          // legacy column sync
                .quantity(qty)
                .availableStock(qty)         // legacy column sync
                .minimumOrderQty(req.getMinimumOrderQty() != null ? req.getMinimumOrderQty() : 50)
                .build();

        supplierProductRepository.save(sp);
        return ApiResponse.success("Product added to catalog", SupplierProductResponse.from(sp));
    }

    // ── Update product (with optional image replace) ──────────────────────────
    @Transactional
    public ApiResponse<SupplierProductResponse> updateProduct(Long id,
                                                              String dataJson,
                                                              MultipartFile image) {
        SupplierProductRequest req = parse(dataJson);
        if (req.getUnitPrice() == null && req.getSellingPrice() != null) {
            req.setUnitPrice(req.getSellingPrice());
        }
        if (req.getAvailableStock() == null && req.getQuantity() != null) {
            req.setAvailableStock(req.getQuantity());
        }
        validateRequest(req);
        validateUnitAndSize(req);
        validateDates(req);
        validatePrices(req);

        SupplierProduct sp = findAndOwn(id);
        validateSupplierProductConstraints(req, sp.getSupplier(), id);

        // Replace image if a new one is provided
        String imagePath = saveImage(image, sp.getProductImage());

        BigDecimal selling = resolveSelling(req);
        Integer    qty     = resolveQty(req);

        sp.setName(req.getName());
        sp.setCategory(req.getCategory());
        sp.setBrand(req.getBrand());
        sp.setUnit(req.getUnit());
        sp.setUnitSize(req.getUnitSize());
        sp.setDescription(req.getDescription());
        sp.setBarcodeNumber(req.getBarcodeNumber());
        sp.setProductImage(imagePath);
        sp.setManufacturingDate(req.getManufacturingDate());
        sp.setExpiryDate(req.getExpiryDate());
        sp.setPurchasePrice(req.getPurchasePrice());
        sp.setSellingPrice(selling);
        sp.setUnitPrice(selling);          // explicit db column population
        sp.setQuantity(qty);
        sp.setAvailableStock(qty);          // explicit db column population
        if (req.getMinimumOrderQty() != null) sp.setMinimumOrderQty(req.getMinimumOrderQty());

        supplierProductRepository.save(sp);
        return ApiResponse.success("Product updated", SupplierProductResponse.from(sp));
    }

    // ── Delete product ────────────────────────────────────────────────────────
    @Transactional
    public ApiResponse<String> deleteProduct(Long id) {
        SupplierProduct sp = findAndOwn(id);
        // Remove image file if present
        deleteImageFile(sp.getProductImage());
        supplierProductRepository.delete(sp);
        return ApiResponse.success("Product deleted", "OK");
    }

    // ── My catalog (supplier sees own products) ───────────────────────────────
    public ApiResponse<List<SupplierProductResponse>> getMyCatalog() {
        Supplier supplier = currentSupplier();
        List<SupplierProductResponse> list =
                supplierProductRepository.findAllBySupplierOrderByCreatedAtDesc(supplier)
                        .stream().map(SupplierProductResponse::from).collect(Collectors.toList());
        return ApiResponse.success("My catalog", list);
    }

    // ── All active products (owner browsing) ──────────────────────────────────
    public ApiResponse<List<SupplierProductResponse>> getAllActiveProducts(String q) {
        List<SupplierProductResponse> list;
        if (q != null && !q.isBlank()) {
            list = supplierProductRepository.searchActive(q)
                    .stream()
                    .filter(sp -> !"Expired".equalsIgnoreCase(sp.getStatus()))
                    .map(SupplierProductResponse::from)
                    .collect(Collectors.toList());
        } else {
            list = supplierProductRepository.findAllByActiveTrueOrderByCreatedAtDesc()
                    .stream()
                    .filter(sp -> !"Expired".equalsIgnoreCase(sp.getStatus()))
                    .map(SupplierProductResponse::from)
                    .collect(Collectors.toList());
        }
        return ApiResponse.success("Supplier catalog", list);
    }

    // ── Products by specific supplier ─────────────────────────────────────────
    public ApiResponse<List<SupplierProductResponse>> getBySupplierId(Long supplierId) {
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new RuntimeException("Supplier not found"));
        List<SupplierProductResponse> list =
                supplierProductRepository.findAllBySupplierAndActiveTrueOrderByCreatedAtDesc(supplier)
                        .stream()
                        .filter(sp -> !"Expired".equalsIgnoreCase(sp.getStatus()))
                        .map(SupplierProductResponse::from)
                        .collect(Collectors.toList());
        return ApiResponse.success("Supplier products", list);
    }

    // ── Image save helper ─────────────────────────────────────────────────────
    /**
     * Saves an uploaded image to uploads/products/.
     * If image is null/empty, returns the existing path unchanged.
     * Supported: jpg, jpeg, png, webp. Max 5 MB enforced here.
     */
    private String saveImage(MultipartFile image, String existingPath) {
        if (image == null || image.isEmpty()) return existingPath;

        String originalName = image.getOriginalFilename() != null
                ? image.getOriginalFilename().toLowerCase() : "";
        if (!originalName.matches(".*\\.(jpg|jpeg|png|webp)$")) {
            throw new RuntimeException("Only JPG, JPEG, PNG, and WEBP images are allowed");
        }
        if (image.getSize() > 5 * 1024 * 1024) {
            throw new RuntimeException("Image size must not exceed 5 MB");
        }

        try {
            Path dir = Paths.get(uploadDir, "products").toAbsolutePath().normalize();
            Files.createDirectories(dir);

            String ext      = originalName.substring(originalName.lastIndexOf('.'));
            String filename = UUID.randomUUID() + ext;
            Path   dest     = dir.resolve(filename);
            Files.copy(image.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

            // Delete old image file if replacing
            if (existingPath != null && !existingPath.isBlank()) {
                deleteImageFile(existingPath);
            }

            // Return relative URL path served by WebMvcConfig
            return "/uploads/products/" + filename;
        } catch (IOException e) {
            throw new RuntimeException("Failed to save image: " + e.getMessage());
        }
    }

    /** Silently removes an image file given its relative URL path */
    private void deleteImageFile(String imagePath) {
        if (imagePath == null || imagePath.isBlank()) return;
        try {
            // imagePath is like /uploads/products/xxx.jpg
            String relative = imagePath.startsWith("/") ? imagePath.substring(1) : imagePath;
            Path file = Paths.get(uploadDir).resolve(
                    relative.replace("uploads/", "")).toAbsolutePath().normalize();
            Files.deleteIfExists(file);
        } catch (IOException ignored) { }
    }

    private void validateRequest(SupplierProductRequest req) {
        Set<ConstraintViolation<SupplierProductRequest>> violations = validator.validate(req);
        if (!violations.isEmpty()) {
            throw new ConstraintViolationException(violations);
        }
    }

    private void validateUnitAndSize(SupplierProductRequest req) {
        if (req.getUnit() == null || req.getUnit().trim().isEmpty()) {
            throw new IllegalArgumentException("Unit is required");
        }
        String unit = req.getUnit().trim();
        java.util.List<String> sizeRequiredUnits = java.util.List.of("Kg", "Gram (g)", "Gram", "Litre", "ml");
        java.util.List<String> sizeNullUnits = java.util.List.of("Piece", "Box", "Pack", "Bottle", "Bundle", "Roll", "Meter", "Dozen");
        
        if (sizeRequiredUnits.contains(unit)) {
            if (req.getUnitSize() == null || req.getUnitSize().trim().isEmpty()) {
                throw new IllegalArgumentException(
                    (unit.equals("Kg") || unit.equals("Gram") || unit.equals("Gram (g)")) ? "Weight size is required" : "Volume size is required"
                );
            }
        } else if (sizeNullUnits.contains(unit)) {
            req.setUnitSize(null);
        }
    }

    // ── Validation helpers ────────────────────────────────────────────────────
    private void validateDates(SupplierProductRequest req) {
        String category = req.getCategory() != null ? req.getCategory().trim().toLowerCase() : "";
        
        // 1. Categories that do NOT require MFD/Expiry: nullify them
        java.util.List<String> noDateCats = java.util.List.of(
            "dress", "clothing", "boxes", "plastic products", "stationery", "furniture",
            "dresses", "box", "plastic"
        );
        if (noDateCats.contains(category)) {
            req.setManufacturingDate(null);
            req.setExpiryDate(null);
            return;
        }

        // 2. Categories that REQUIRE MFD/Expiry
        java.util.List<String> requiredDateCats = java.util.List.of(
            "medicines", "medicine", "food", "beverages", "beverage", "cosmetics", "cosmetic",
            "dairy products", "dairy", "bakery products", "bakery"
        );
        if (requiredDateCats.contains(category)) {
            if (req.getManufacturingDate() == null || req.getExpiryDate() == null) {
                throw new RuntimeException("Manufacturing Date and Expiry Date are mandatory for category: " + req.getCategory());
            }
        }

        // 3. Expiry date comparison validation
        if (req.getManufacturingDate() != null && req.getExpiryDate() != null) {
            if (!req.getExpiryDate().isAfter(req.getManufacturingDate())) {
                throw new RuntimeException("Expiry Date must be later than Manufacturing Date.");
            }
        }
    }

    private void validatePrices(SupplierProductRequest req) {
        BigDecimal selling = resolveSelling(req);
        if (req.getPurchasePrice() != null && selling != null) {
            if (selling.compareTo(req.getPurchasePrice()) < 0) {
                throw new RuntimeException("Selling price cannot be less than purchase price");
            }
        }
    }

    private void validateSupplierProductConstraints(SupplierProductRequest req, Supplier supplier, Long productId) {
        if (req.getBarcodeNumber() == null || req.getBarcodeNumber().isBlank()) {
            throw new RuntimeException("Manufacturer barcode is required");
        }
        Integer qty = resolveQty(req);
        if (qty == null || qty <= 0) {
            throw new RuntimeException("Quantity must be greater than 0");
        }
        if (req.getMinimumOrderQty() != null && req.getMinimumOrderQty() < 50) {
            throw new RuntimeException("Minimum Order Quantity must be 50 or above.");
        }
        if (req.getBarcodeNumber() != null && !req.getBarcodeNumber().trim().isEmpty()) {
            boolean exists = supplierProductRepository.findAllBySupplierOrderByCreatedAtDesc(supplier).stream()
                    .anyMatch(p -> (productId == null || !p.getId().equals(productId)) && req.getBarcodeNumber().equals(p.getBarcodeNumber()));
            if (exists) {
                throw new RuntimeException("Barcode already exists in your catalog.");
            }
        }
    }

    private BigDecimal resolveSelling(SupplierProductRequest req) {
        if (req.getSellingPrice() != null) return req.getSellingPrice();
        if (req.getUnitPrice()    != null) return req.getUnitPrice();
        return req.getPurchasePrice(); // safe fallback
    }

    private Integer resolveQty(SupplierProductRequest req) {
        if (req.getQuantity()      != null) return req.getQuantity();
        if (req.getAvailableStock() != null) return req.getAvailableStock();
        return 0;
    }

    // ── Parse JSON part ───────────────────────────────────────────────────────
    private SupplierProductRequest parse(String json) {
        try {
            return MAPPER.readValue(json, SupplierProductRequest.class);
        } catch (Exception e) {
            throw new RuntimeException("Invalid request data: " + e.getMessage());
        }
    }

    // ── Security helpers ──────────────────────────────────────────────────────
    private Supplier currentSupplier() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return supplierRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Only suppliers can manage supplier products"));
    }

    private SupplierProduct findAndOwn(Long id) {
        Supplier supplier = currentSupplier();
        SupplierProduct sp = supplierProductRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        if (!sp.getSupplier().getId().equals(supplier.getId()))
            throw new RuntimeException("Access denied");
        return sp;
    }
}
