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
    private final ProductBatchRepository productBatchRepository;
    private final StaffRepository staffRepository;
    private final BranchRepository branchRepository;
    private final AuditLogRepository auditLogRepository;
    private final BarcodeService barcodeService;

    @Transactional
    public ApiResponse<InvoiceResponse> createInvoice(InvoiceRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();

        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        Staff staffUser = null;
        if (auth != null && auth.isAuthenticated()) {
            String email = auth.getName();
            java.util.Optional<Staff> staffOpt = staffRepository.findByEmail(email);
            if (staffOpt.isPresent()) {
                staffUser = staffOpt.get();
                if (!staffUser.isBillingPermission()) {
                    throw new BadRequestException("You do not have permission to perform billing. Please contact the Owner.");
                }
            }
        }

        Customer customer = null;
        if (request.getCustomerId() != null) {
            // Ensure the customer belongs to this admin
            customer = customerService.findByIdAndAdmin(request.getCustomerId());
        }

        Long creatorId = admin.getId();
        String creatorName = admin.getFullName();
        String creatorRole = "OWNER";
        if (staffUser != null) {
            creatorId = staffUser.getId();
            creatorName = staffUser.getFullName();
            creatorRole = "STAFF";
        }
        String payMethod = request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank() 
                ? request.getPaymentMethod() : "Cash";

        Long activeBranchId = securityUtils.getCurrentBranchId();
        if (activeBranchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(admin.getId());
            if (!branches.isEmpty()) {
                throw new BadRequestException("Branch selection is required.");
            }
        }
        Branch activeBranch = null;
        String bName = null;
        String bCode = null;
        if (activeBranchId != null) {
            activeBranch = branchRepository.findByIdAndAdminId(activeBranchId, admin.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + activeBranchId));
            bName = activeBranch.getName();
            bCode = activeBranch.getCode();
        }

        Invoice invoice = Invoice.builder()
                .admin(admin)
                .invoiceNumber(generateInvoiceNumber(admin.getId()))
                .customer(customer)
                .staff(staffUser)
                .branch(activeBranch)
                .branchName(bName)
                .branchCode(bCode)
                .createdById(creatorId)
                .createdByName(creatorName)
                .createdByRole(creatorRole)
                .paymentMethod(payMethod)
                .discountPercentage(request.getDiscountPercentage() != null
                        ? request.getDiscountPercentage() : BigDecimal.ZERO)
                .notes(request.getNotes())
                .status(Invoice.InvoiceStatus.PAID)
                .build();

        List<InvoiceItem> items = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (InvoiceRequest.InvoiceItemRequest itemReq : request.getItems()) {
            // Ensure product belongs to this admin
            Product product = productRepository.findByIdAndAdminIdAndBranchId(itemReq.getProductId(), admin.getId(), activeBranchId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId()));

            if (activeBranchId != null && product.getBranch() != null && !product.getBranch().getId().equals(activeBranchId)) {
                throw new BadRequestException("Product " + product.getName() + " does not belong to the selected branch.");
            }

            // Category Expiry check exclusion list
            String category = product.getCategory() != null ? product.getCategory().trim().toLowerCase() : "";
            java.util.List<String> noDateCats = java.util.List.of(
                "dress", "clothing", "boxes", "plastic products", "stationery", "furniture",
                "dresses", "box", "plastic"
            );
            boolean checkExpiry = !noDateCats.contains(category);

            // If expiry checks are required and the product is expired, block billing
            if (checkExpiry && "Expired".equalsIgnoreCase(product.getStatus())) {
                throw new BadRequestException("This product has expired and cannot be billed.");
            }

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

            // Deduct from batches using FIFO while skipping expired batches for date-checked categories
            int needed = itemReq.getQuantity();
            List<ProductBatch> batches = productBatchRepository
                    .findAllByProductAndAdminAndBranchOrderByExpiryDateAscCreatedAtAsc(product, admin, activeBranch);

            for (ProductBatch b : batches) {
                if (needed <= 0) break;
                if (!b.isActive() || b.getQuantityRemaining() <= 0) continue;

                // Skip expired batch if expiry verification applies
                if (checkExpiry && b.getExpiryDate() != null && b.getExpiryDate().isBefore(LocalDate.now())) {
                    continue;
                }

                int take = Math.min(needed, b.getQuantityRemaining());
                b.setQuantityRemaining(b.getQuantityRemaining() - take);
                if (b.getQuantityRemaining() == 0) {
                    b.setActive(false);
                }
                productBatchRepository.save(b);
                needed -= take;
            }

            product.setCurrentStock(product.getCurrentStock() - itemReq.getQuantity());
            productRepository.save(product);
            barcodeService.handleLowStockAlerts(product, admin);
        }

        BigDecimal requestedDiscountPercent = request.getDiscountPercentage() != null
                ? request.getDiscountPercentage()
                : BigDecimal.ZERO;
        // Use the discount percentage as sent by the frontend exactly — the frontend already
        // handles auto-discount logic and sends the final resolved percentage.
        BigDecimal discountPercent = requestedDiscountPercent;

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

        String emailName = auth != null && auth.isAuthenticated() ? auth.getName() : "SYSTEM";
        for (InvoiceItem item : invoice.getItems()) {
            auditLogRepository.save(AuditLog.builder()
                    .ownerId(admin.getId())
                    .branchId(activeBranchId)
                    .productId(item.getProduct().getId())
                    .action("BILLING")
                    .productName(item.getProductName())
                    .quantity(item.getQuantity())
                    .userEmail(emailName)
                    .build());

            auditLogRepository.save(AuditLog.builder()
                    .ownerId(admin.getId())
                    .branchId(activeBranchId)
                    .productId(item.getProduct().getId())
                    .action("STOCK_REDUCED")
                    .productName(item.getProductName())
                    .quantity(item.getQuantity())
                    .userEmail(emailName)
                    .build());
        }

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
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<Invoice> list = invoiceRepository.findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(adminId, branchId);
        List<InvoiceResponse> invoices = list
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Invoices retrieved", invoices);
    }

    public ApiResponse<InvoiceResponse> getInvoiceById(Long id) {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", id));
        if (!invoice.getAdmin().getId().equals(adminId) ||
            (branchId != null && invoice.getBranch() != null && !invoice.getBranch().getId().equals(branchId))) {
            throw new RuntimeException("Access denied: Invoice belongs to another branch.");
        }
        return ApiResponse.success("Invoice retrieved", mapToResponse(invoice));
    }

    public ApiResponse<List<InvoiceResponse>> getInvoicesByCustomer(Long customerId) {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<InvoiceResponse> invoices = invoiceRepository.findByAdminIdAndBranchIdAndCustomerId(adminId, branchId, customerId)
                .stream()
                .map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Customer invoices retrieved", invoices);
    }

    public ApiResponse<SalesReportResponse> getSalesReport(LocalDate from, LocalDate to) {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.atTime(LocalTime.MAX);

        List<Invoice> invoices = invoiceRepository.findByAdminIdAndBranchIdAndDateRange(adminId, branchId, start, end);

        BigDecimal totalRevenue = invoices.stream()
                .filter(i -> i.getStatus() == Invoice.InvoiceStatus.PAID)
                .map(Invoice::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

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
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<InvoiceResponse> invoices = invoiceRepository.searchByAdminIdAndBranchId(adminId, branchId, search)
                .stream()
                .map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Search results", invoices);
    }

    private String generateInvoiceNumber(Long adminId) {
        String prefix = "INV-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        String todayPattern = prefix + "%";
        long todayCount = invoiceRepository.countByInvoiceNumberLike(todayPattern);
        
        String invoiceNum = prefix + String.format("%04d", todayCount + 1);
        int attempts = 0;
        while (invoiceRepository.existsByInvoiceNumber(invoiceNum) && attempts < 100) {
            todayCount++;
            invoiceNum = prefix + String.format("%04d", todayCount + 1);
            attempts++;
        }
        return invoiceNum;
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
                .staffId(invoice.getStaff() != null ? invoice.getStaff().getId() : null)
                .staffName(invoice.getStaff() != null ? invoice.getStaff().getFullName() : null)
                .createdById(invoice.getCreatedById())
                .createdByName(invoice.getCreatedByName())
                .createdByRole(invoice.getCreatedByRole())
                .paymentMethod(invoice.getPaymentMethod())
                .createdAt(invoice.getCreatedAt())
                .build();
    }
}
