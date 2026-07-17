package com.smartinventory.controller;

import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.SupplierProductResponse;
import com.smartinventory.service.SupplierProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/supplier-products")
@RequiredArgsConstructor
@Tag(name = "Supplier Products", description = "Supplier manages own catalog; Owner browses all")
public class SupplierProductController {

    private final SupplierProductService service;

    /* ── Supplier: manage own catalog ──────────────────────────────────────── */

    /**
     * Add a product with optional image.
     * Content-Type: multipart/form-data
     *   - "data"  : JSON string of SupplierProductRequest
     *   - "image" : image file (optional, JPG/PNG/WEBP, max 5 MB)
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Supplier adds a product to their catalog (supports image upload)")
    public ResponseEntity<ApiResponse<SupplierProductResponse>> add(
            @RequestPart("data") String dataJson,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.addProduct(dataJson, image));
    }

    /**
     * Update a product with optional image replacement.
     * Same multipart format as add.
     */
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Supplier updates their product (supports image replacement)")
    public ResponseEntity<ApiResponse<SupplierProductResponse>> update(
            @PathVariable Long id,
            @RequestPart("data") String dataJson,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        return ResponseEntity.ok(service.updateProduct(id, dataJson, image));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supplier deletes their product")
    public ResponseEntity<ApiResponse<String>> delete(@PathVariable Long id) {
        return ResponseEntity.ok(service.deleteProduct(id));
    }

    @GetMapping("/my-catalog")
    @Operation(summary = "Supplier views their own catalog")
    public ResponseEntity<ApiResponse<List<SupplierProductResponse>>> myCatalog() {
        return ResponseEntity.ok(service.getMyCatalog());
    }

    /* ── Owner / anyone authenticated: browse supplier catalog ────────────── */

    @GetMapping
    @Operation(summary = "Browse all active supplier products (Owner view). Search by name, brand, category, barcode.")
    public ResponseEntity<ApiResponse<List<SupplierProductResponse>>> getAll(
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(service.getAllActiveProducts(q));
    }

    @GetMapping("/by-supplier/{supplierId}")
    @Operation(summary = "Get products by a specific supplier")
    public ResponseEntity<ApiResponse<List<SupplierProductResponse>>> getBySupplierId(
            @PathVariable Long supplierId) {
        return ResponseEntity.ok(service.getBySupplierId(supplierId));
    }
}
