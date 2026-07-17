package com.smartinventory.controller;

import com.google.zxing.*;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Product;
import com.smartinventory.entity.BarcodeScanHistory;
import com.smartinventory.repository.ProductBatchRepository;
import com.smartinventory.repository.ProductRepository;
import com.smartinventory.service.BarcodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/barcode")
@RequiredArgsConstructor
@Tag(name = "Barcode", description = "Decode barcode image and look up product")
public class BarcodeController {

    private final ProductRepository productRepository;
    private final ProductBatchRepository productBatchRepository;
    private final BarcodeService barcodeService;

    /**
     * POST /api/barcode/decode
     * Accepts an image file (from laptop/phone camera), decodes it with ZXing,
     * and returns the barcode string + matching product info if found.
     */
    @PostMapping("/decode")
    @Operation(summary = "Decode barcode image and return product info")
    public ResponseEntity<ApiResponse<Map<String, Object>>> decode(
            @RequestParam("image") MultipartFile imageFile,
            @RequestParam(value = "action", required = false, defaultValue = "SEARCH") String action,
            @AuthenticationPrincipal UserDetails userDetails) {

        System.out.println("\n--- [DEBUG DECODE REQUEST START] ---");
        System.out.println("DEBUG Request User: " + (userDetails != null ? userDetails.getUsername() : "anonymous"));
        System.out.println("DEBUG File param: size = " + imageFile.getSize() + " bytes, content type = " + imageFile.getContentType());

        String barcode = null;
        try {
            InputStream stream = imageFile.getInputStream();
            BufferedImage image = ImageIO.read(stream);
            if (image == null) {
                System.out.println("DEBUG Error: BufferedImage is null. Could not read image stream.");
                throw new RuntimeException("Cannot read image");
            }
            System.out.println("DEBUG Image Dimensions: " + image.getWidth() + "x" + image.getHeight());

            // Add a white quiet zone (border) around the image to help ZXing decode cropped barcodes
            int border = 25;
            BufferedImage borderedImage = new BufferedImage(
                    image.getWidth() + (border * 2),
                    image.getHeight() + (border * 2),
                    BufferedImage.TYPE_INT_RGB
            );
            java.awt.Graphics2D g = borderedImage.createGraphics();
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, borderedImage.getWidth(), borderedImage.getHeight());
            g.drawImage(image, border, border, null);
            g.dispose();
            image = borderedImage;
            System.out.println("DEBUG Padded Image Dimensions: " + image.getWidth() + "x" + image.getHeight());

            LuminanceSource source = new BufferedImageLuminanceSource(image);
            Map<DecodeHintType, Object> hints = new HashMap<>();
            hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
            hints.put(DecodeHintType.POSSIBLE_FORMATS, List.of(
                    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.CODE_128,
                    BarcodeFormat.CODE_39, BarcodeFormat.QR_CODE, BarcodeFormat.UPC_A,
                    BarcodeFormat.UPC_E, BarcodeFormat.ITF
            ));

            Result result = null;
            
            // Strategy 1: Original + HybridBinarizer
            System.out.println("DEBUG Strategy 1: Running HybridBinarizer...");
            try {
                BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(source));
                result = new MultiFormatReader().decode(bitmap, hints);
                System.out.println("DEBUG Strategy 1: SUCCESS. Found code = " + result.getText());
            } catch (NotFoundException ignored) {
                System.out.println("DEBUG Strategy 1: FAILED (NotFoundException)");
            }

            // Strategy 2: Original + GlobalHistogramBinarizer
            if (result == null) {
                System.out.println("DEBUG Strategy 2: Running GlobalHistogramBinarizer...");
                try {
                    BinaryBitmap bitmap = new BinaryBitmap(new com.google.zxing.common.GlobalHistogramBinarizer(source));
                    result = new MultiFormatReader().decode(bitmap, hints);
                    System.out.println("DEBUG Strategy 2: SUCCESS. Found code = " + result.getText());
                } catch (NotFoundException ignored) {
                    System.out.println("DEBUG Strategy 2: FAILED (NotFoundException)");
                }
            }

            // Strategy 3: Grayscale + GlobalHistogramBinarizer
            if (result == null) {
                System.out.println("DEBUG Strategy 3: Running Grayscale + GlobalHistogramBinarizer...");
                try {
                    BufferedImage gray = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
                    java.awt.Graphics2D g2 = gray.createGraphics();
                    g2.drawImage(image, 0, 0, null);
                    g2.dispose();
                    LuminanceSource graySource = new BufferedImageLuminanceSource(gray);
                    BinaryBitmap bitmap = new BinaryBitmap(new com.google.zxing.common.GlobalHistogramBinarizer(graySource));
                    result = new MultiFormatReader().decode(bitmap, hints);
                    System.out.println("DEBUG Strategy 3: SUCCESS. Found code = " + result.getText());
                } catch (NotFoundException ignored) {
                    System.out.println("DEBUG Strategy 3: FAILED (NotFoundException)");
                }
            }

            if (result == null) {
                throw NotFoundException.getNotFoundInstance();
            }
            barcode = result.getText();
        } catch (NotFoundException e) {
            System.out.println("DEBUG Decode Result: No barcode detected in frame.");
            System.out.println("--- [DEBUG DECODE REQUEST END] ---\n");
            barcodeService.logScan("UNKNOWN", "Decoding Failed", null, "FAILED_DECODE", "Webcam Scanner");
            return ResponseEntity.ok(ApiResponse.success("No barcode found in image", null));
        } catch (Exception e) {
            System.err.println("DEBUG Decode Error: Exception occurred during ZXing run.");
            e.printStackTrace();
            System.out.println("--- [DEBUG DECODE REQUEST END] ---\n");
            return ResponseEntity.ok(ApiResponse.success("Decode error: " + e.getMessage(), null));
        }

        System.out.println("DEBUG Decoded Barcode Value: " + barcode);

        // Perform standard lookup logic with branch and expiry checks
        ApiResponse<Map<String, Object>> lookupRes = barcodeService.performBarcodeLookup(barcode, action, "Webcam Scanner");
        return ResponseEntity.ok(lookupRes);
    }

    /**
     * GET /api/barcode/lookup/{barcode}
     * Text-based lookup (barcode number typed manually when camera unavailable).
     */
    @GetMapping("/lookup/{barcode}")
    @Operation(summary = "Look up product by barcode string")
    public ResponseEntity<ApiResponse<Map<String, Object>>> lookup(
            @PathVariable String barcode,
            @RequestParam(value = "action", required = false, defaultValue = "SEARCH") String action,
            @AuthenticationPrincipal UserDetails userDetails) {

        ApiResponse<Map<String, Object>> lookupRes = barcodeService.performBarcodeLookup(barcode, action, "Manual Search");
        return ResponseEntity.ok(lookupRes);
    }

    /**
     * GET /api/barcode/history
     * Retrieves barcode scan history for this admin context.
     */
    @GetMapping("/history")
    @Operation(summary = "Get barcode scan history")
    public ResponseEntity<ApiResponse<List<BarcodeScanHistory>>> getScanHistory() {
        return ResponseEntity.ok(barcodeService.getScanHistory());
    }

    /**
     * POST /api/barcode/verify
     * Reconciles stock verification for scanned products.
     */
    @PostMapping("/verify")
    @Operation(summary = "Reconcile expected stock against actual scanned stock")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> verifyInventory(
            @RequestBody Map<String, Integer> scannedItems,
            @RequestParam(value = "notes", required = false) String notes) {
        return ResponseEntity.ok(barcodeService.verifyInventory(scannedItems, notes));
    }

    /**
     * POST /api/barcode/return/customer/request
     * Submits a customer return request.
     */
    @PostMapping(value = "/return/customer/request", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Submit customer return request")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitCustomerReturnRequest(
            @RequestParam String invoiceNumber,
            @RequestParam String barcode,
            @RequestParam Integer quantity,
            @RequestParam String condition,
            @RequestParam(required = false) String notes,
            @RequestParam(value = "files", required = false) List<MultipartFile> files) {
        return ResponseEntity.ok(barcodeService.submitCustomerReturnRequest(invoiceNumber, barcode, quantity, condition, notes, files));
    }

    @PostMapping("/return/customer/{id}/approve")
    @Operation(summary = "Approve customer return request")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approveCustomerReturn(@PathVariable Long id) {
        return ResponseEntity.ok(barcodeService.approveCustomerReturn(id));
    }

    @PostMapping("/return/customer/{id}/reject")
    @Operation(summary = "Reject customer return request")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rejectCustomerReturn(
            @PathVariable Long id,
            @RequestParam String reason) {
        return ResponseEntity.ok(barcodeService.rejectCustomerReturn(id, reason));
    }

    @PostMapping("/return/customer/{id}/refund")
    @Operation(summary = "Process refund for approved customer return")
    public ResponseEntity<ApiResponse<Map<String, Object>>> processCustomerRefund(
            @PathVariable Long id,
            @RequestParam String refundMethod) {
        return ResponseEntity.ok(barcodeService.processCustomerRefund(id, refundMethod));
    }

    @PostMapping("/return/customer/{id}/exchange")
    @Operation(summary = "Process exchange for approved customer return")
    public ResponseEntity<ApiResponse<Map<String, Object>>> processCustomerExchange(
            @PathVariable Long id,
            @RequestParam String exchangeBarcode,
            @RequestParam Integer exchangeQty) {
        return ResponseEntity.ok(barcodeService.processCustomerExchange(id, exchangeBarcode, exchangeQty));
    }

    @GetMapping("/return/customer/invoice/{invoiceNumber}")
    @Operation(summary = "Get returnable products for a customer invoice")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getCustomerReturnProducts(
            @PathVariable String invoiceNumber) {
        return ResponseEntity.ok(barcodeService.getCustomerReturnProducts(invoiceNumber));
    }

    /**
     * POST /api/barcode/return/supplier
     * Processes a supplier return by barcode with multiple evidence files.
     */
    @PostMapping(value = "/return/supplier", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Process product return to a supplier")
    public ResponseEntity<ApiResponse<Map<String, Object>>> processSupplierReturn(
            @RequestParam String barcode,
            @RequestParam Integer quantity,
            @RequestParam(required = false) String notes,
            @RequestParam(value = "files", required = false) List<MultipartFile> files) {
        return ResponseEntity.ok(barcodeService.processSupplierReturn(barcode, quantity, notes, files));
    }

    @GetMapping("/return/supplier/list")
    @Operation(summary = "Get return requests for a supplier")
    public ResponseEntity<ApiResponse<List<com.smartinventory.entity.ProductReturn>>> getSupplierReturns() {
        return ResponseEntity.ok(barcodeService.getSupplierReturns());
    }

    @PostMapping("/return/supplier/{id}/accept")
    @Operation(summary = "Accept a product return request")
    public ResponseEntity<ApiResponse<Map<String, Object>>> acceptSupplierReturn(@PathVariable Long id) {
        return ResponseEntity.ok(barcodeService.acceptSupplierReturn(id));
    }

    @PostMapping("/return/supplier/{id}/reject")
    @Operation(summary = "Reject a product return request")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rejectSupplierReturn(
            @PathVariable Long id,
            @RequestParam String reason) {
        return ResponseEntity.ok(barcodeService.rejectSupplierReturn(id, reason));
    }

    @GetMapping("/return/owner/list")
    @Operation(summary = "Get return requests history for owner")
    public ResponseEntity<ApiResponse<List<com.smartinventory.entity.ProductReturn>>> getOwnerReturns() {
        return ResponseEntity.ok(barcodeService.getOwnerReturns());
    }
}
