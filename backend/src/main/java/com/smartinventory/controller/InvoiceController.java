package com.smartinventory.controller;

import com.smartinventory.dto.request.InvoiceRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.InvoiceResponse;
import com.smartinventory.dto.response.SalesReportResponse;
import com.smartinventory.service.InvoiceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
@Tag(name = "Invoices", description = "Billing and invoice management endpoints")
public class InvoiceController {

    private final InvoiceService invoiceService;

    @PostMapping
    @Operation(summary = "Create a new invoice")
    public ResponseEntity<ApiResponse<InvoiceResponse>> createInvoice(
            @Valid @RequestBody InvoiceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(invoiceService.createInvoice(request));
    }

    @GetMapping
    @Operation(summary = "Get all invoices")
    public ResponseEntity<ApiResponse<List<InvoiceResponse>>> getAllInvoices() {
        return ResponseEntity.ok(invoiceService.getAllInvoices());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get invoice by ID")
    public ResponseEntity<ApiResponse<InvoiceResponse>> getInvoiceById(@PathVariable Long id) {
        return ResponseEntity.ok(invoiceService.getInvoiceById(id));
    }

    @GetMapping("/customer/{customerId}")
    @Operation(summary = "Get invoices by customer")
    public ResponseEntity<ApiResponse<List<InvoiceResponse>>> getByCustomer(@PathVariable Long customerId) {
        return ResponseEntity.ok(invoiceService.getInvoicesByCustomer(customerId));
    }

    @GetMapping("/report")
    @Operation(summary = "Get sales report by date range")
    public ResponseEntity<ApiResponse<SalesReportResponse>> getSalesReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(invoiceService.getSalesReport(from, to));
    }

    @GetMapping("/search")
    @Operation(summary = "Search invoices")
    public ResponseEntity<ApiResponse<List<InvoiceResponse>>> searchInvoices(@RequestParam String q) {
        return ResponseEntity.ok(invoiceService.searchInvoices(q));
    }
}
