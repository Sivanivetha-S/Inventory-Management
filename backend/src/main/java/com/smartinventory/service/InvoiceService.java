package com.smartinventory.service;

import com.smartinventory.email.EmailService;
import com.smartinventory.dto.request.InvoiceRequest;
import com.smartinventory.dto.response.*;
import com.smartinventory.entity.*;
import com.smartinventory.exception.BadRequestException;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.*;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final CustomerService customerService;
    private final SecurityUtils securityUtils;
    private final EmailService emailService;
    private final DiscountRepository discountRepository;

    @Transactional
    public ApiResponse<InvoiceResponse> createInvoice(InvoiceRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();

        Customer customer = null;
        if (request.getCustomerId() != null) {
            // Ensure the customer belongs to this admin
            customer = customerRepository.findByIdAndAdminId(request.getCustomerId(), admin.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Customer", request.getCustomerId()));
        }

        Invoice invoice = Invoice.builder()
                .admin(admin)
                .invoiceNumber(generateInvoiceNumber(admin.getId()))
                .customer(customer)
                .discountPercentage(request.getDiscountPercentage() != null
                        ? request.getDiscountPercentage() : BigDecimal.ZERO)
                .notes(request.getNotes())
                .status(Invoice.InvoiceStatus.PAID)
                .build();

        List<InvoiceItem> items = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (InvoiceRequest.InvoiceItemRequest itemReq : request.getItems()) {
            // Ensure product belongs to this admin
            Product product = productRepository.findByIdAndAdminId(itemReq.getProductId(), admin.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId()));

            if (product.getCurrentStock() < itemReq.getQuantity()) {
                throw new BadRequestException("Insufficient stock for: " + product.getName()
                        + ". Available: " + product.getCurrentStock());
            }

            BigDecimal itemTotal = product.getSellingPrice()
                    .multiply(BigDecimal.valueOf(itemReq.getQuantity()));

            InvoiceItem item = InvoiceItem.builder()
                    .invoice(invoice)
                    .product(product)
                    .productName(product.getName())
                    .quantity(itemReq.getQuantity())
                    .unitPrice(product.getSellingPrice())
                    .totalPrice(itemTotal)
                    .build();
            items.add(item);
            subtotal = subtotal.add(itemTotal);

            product.setCurrentStock(product.getCurrentStock() - itemReq.getQuantity());
            productRepository.save(product);
        }

        BigDecimal requestedDiscountPercent = request.getDiscountPercentage() != null
                ? request.getDiscountPercentage()
                : BigDecimal.ZERO;
        BigDecimal autoDiscountPercent = findBestAutoDiscountPercentage(admin.getId(), subtotal);
        BigDecimal discountPercent = autoDiscountPercent.max(requestedDiscountPercent);

        invoice.setDiscountPercentage(discountPercent);

        BigDecimal discountAmount = subtotal
                .multiply(discountPercent)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal totalAmount = subtotal.subtract(discountAmount);

        invoice.setItems(items);
        invoice.setSubtotal(subtotal);
        invoice.setDiscountAmount(discountAmount);
        invoice.setTotalAmount(totalAmount);

        invoice = invoiceRepository.save(invoice);

        // Send invoice email to customer if they have a verified email
        if (customer != null
                && customer.getEmail() != null
                && !customer.getEmail().isEmpty()
                && customer.isEmailVerified()) {
            try {
                final Invoice savedInvoice = invoice;
                List<String[]> emailItems = savedInvoice.getItems().stream().map(item -> new String[]{
                        item.getProductName(),
                        String.valueOf(item.getQuantity()),
                        String.format("%.2f", item.getUnitPrice()),
                        String.format("%.2f", item.getTotalPrice())
                }).collect(Collectors.toList());

                emailService.sendInvoiceEmail(
                        customer.getEmail(),
                        customer.getName(),
                        savedInvoice.getInvoiceNumber(),
                        admin.getShopName() != null ? admin.getShopName() : admin.getFullName(),
                        emailItems,
                        savedInvoice.getSubtotal().doubleValue(),
                        savedInvoice.getDiscountPercentage().doubleValue(),
                        savedInvoice.getDiscountAmount().doubleValue(),
                        savedInvoice.getTotalAmount().doubleValue()
                );
            } catch (Exception e) {
                // Email failure should not fail the invoice creation
                log.warn("Invoice email to {} failed: {}", customer.getEmail(), e.getMessage());
            }
        }

        return ApiResponse.success("Invoice created successfully", mapToResponse(invoice));
    }

    private BigDecimal findBestAutoDiscountPercentage(Long adminId, BigDecimal subtotal) {
        BigDecimal bestDiscountPercent = BigDecimal.ZERO;
        List<Discount> activeDiscounts = discountRepository.findByAdminIdAndActiveTrue(adminId);

        if (activeDiscounts == null) {
            return bestDiscountPercent;
        }

        for (Discount discount : activeDiscounts) {
            BigDecimal minimumPurchaseAmount = discount.getMinimumPurchaseAmount() != null
                    ? discount.getMinimumPurchaseAmount()
                    : BigDecimal.ZERO;
            BigDecimal percentage = discount.getPercentage() != null
                    ? discount.getPercentage()
                    : BigDecimal.ZERO;

            if (subtotal.compareTo(minimumPurchaseAmount) >= 0) {
                bestDiscountPercent = bestDiscountPercent.max(percentage);
            }
        }

        return bestDiscountPercent;
    }

    public ApiResponse<List<InvoiceResponse>> getAllInvoices() {
        Long adminId = securityUtils.getCurrentAdminId();
        List<InvoiceResponse> invoices = invoiceRepository.findAllByAdminIdOrderByCreatedAtDesc(adminId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Invoices retrieved", invoices);
    }

    public ApiResponse<InvoiceResponse> getInvoiceById(Long id) {
        Long adminId = securityUtils.getCurrentAdminId();
        Invoice invoice = invoiceRepository.findById(id)
                .filter(i -> i.getAdmin().getId().equals(adminId))
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", id));
        return ApiResponse.success("Invoice retrieved", mapToResponse(invoice));
    }

    public ApiResponse<List<InvoiceResponse>> getInvoicesByCustomer(Long customerId) {
        Long adminId = securityUtils.getCurrentAdminId();
        List<InvoiceResponse> invoices = invoiceRepository.findByAdminIdAndCustomerId(adminId, customerId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Customer invoices retrieved", invoices);
    }

    public ApiResponse<SalesReportResponse> getSalesReport(LocalDate from, LocalDate to) {
        Long adminId = securityUtils.getCurrentAdminId();
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.atTime(LocalTime.MAX);

        List<Invoice> invoices = invoiceRepository.findByAdminIdAndDateRange(adminId, start, end);
        BigDecimal totalRevenue = invoiceRepository.sumRevenueByAdminIdAndDateRange(adminId, start, end);
        BigDecimal totalDiscount = invoices.stream()
                .map(Invoice::getDiscountAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        SalesReportResponse report = SalesReportResponse.builder()
                .fromDate(from).toDate(to)
                .totalInvoices(invoices.size())
                .totalRevenue(totalRevenue)
                .totalDiscount(totalDiscount)
                .invoices(invoices.stream().map(this::mapToResponse).collect(Collectors.toList()))
                .build();
        return ApiResponse.success("Sales report generated", report);
    }

    public ApiResponse<List<InvoiceResponse>> searchInvoices(String search) {
        Long adminId = securityUtils.getCurrentAdminId();
        List<InvoiceResponse> invoices = invoiceRepository.searchByAdminId(adminId, search)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Search results", invoices);
    }

    private String generateInvoiceNumber(Long adminId) {
        String prefix = "INV-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        long count = invoiceRepository.countByAdminId(adminId) + 1;
        return prefix + String.format("%04d", count);
    }

    public InvoiceResponse mapToResponse(Invoice invoice) {
        List<InvoiceResponse.InvoiceItemResponse> itemResponses = invoice.getItems() == null
                ? new ArrayList<>()
                : invoice.getItems().stream().map(item ->
                    InvoiceResponse.InvoiceItemResponse.builder()
                            .id(item.getId())
                            .productId(item.getProduct() != null ? item.getProduct().getId() : null)
                            .productName(item.getProductName())
                            .quantity(item.getQuantity())
                            .unitPrice(item.getUnitPrice())
                            .totalPrice(item.getTotalPrice())
                            .build()
                ).collect(Collectors.toList());

        return InvoiceResponse.builder()
                .id(invoice.getId())
                .invoiceNumber(invoice.getInvoiceNumber())
                .customer(invoice.getCustomer() != null
                        ? customerService.mapToResponse(invoice.getCustomer()) : null)
                .items(itemResponses)
                .subtotal(invoice.getSubtotal())
                .discountPercentage(invoice.getDiscountPercentage())
                .discountAmount(invoice.getDiscountAmount())
                .totalAmount(invoice.getTotalAmount())
                .status(invoice.getStatus().name())
                .notes(invoice.getNotes())
                .createdAt(invoice.getCreatedAt())
                .build();
    }
}
