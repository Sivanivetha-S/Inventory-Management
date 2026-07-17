package com.smartinventory.service;

import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Branch;
import com.smartinventory.entity.DamageRecord;
import com.smartinventory.entity.Invoice;
import com.smartinventory.entity.InvoiceItem;
import com.smartinventory.entity.Product;
import com.smartinventory.entity.ProductBatch;
import com.smartinventory.entity.ProductReturn;
import com.smartinventory.entity.Supplier;
import com.smartinventory.entity.SupplierDispatch;
import com.smartinventory.entity.SupplyRequest;
import com.smartinventory.entity.TheftRecord;
import com.smartinventory.repository.BranchRepository;
import com.smartinventory.repository.CustomerRepository;
import com.smartinventory.repository.DamageRecordRepository;
import com.smartinventory.repository.InvoiceRepository;
import com.smartinventory.repository.ProductBatchRepository;
import com.smartinventory.repository.ProductRepository;
import com.smartinventory.repository.ProductReturnRepository;
import com.smartinventory.repository.SupplierDispatchRepository;
import com.smartinventory.repository.SupplierRepository;
import com.smartinventory.repository.SupplyRequestRepository;
import com.smartinventory.repository.TheftRecordRepository;
import com.smartinventory.util.SecurityUtils;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatbotService {

    private static final Pattern INVOICE_NUMBER_PATTERN = Pattern.compile("(?:invoice|bill)\\s*(?:number|no\\.?|#)?\\s*([A-Za-z0-9_-]+)", Pattern.CASE_INSENSITIVE);

    private final ProductRepository productRepository;
    private final InvoiceRepository invoiceRepository;
    private final TheftRecordRepository theftRecordRepository;
    private final DamageRecordRepository damageRecordRepository;
    private final ProductReturnRepository productReturnRepository;
    private final CustomerRepository customerRepository;
    private final SupplyRequestRepository supplyRequestRepository;
    private final SupplierDispatchRepository supplierDispatchRepository;
    private final SupplierRepository supplierRepository;
    private final ProductBatchRepository productBatchRepository;
    private final BranchRepository branchRepository;
    private final SecurityUtils securityUtils;

    @Transactional
    public String generateChatResponse(String message, List<Map<String, String>> history) {
        String question = message == null ? "" : message.trim();
        if (question.isEmpty()) {
            return "Please enter a question about your inventory or business reports.";
        }

        if (hasRole("ROLE_SUPPLIER")) {
            return answerSupplierQuestion(question);
        }

        Admin admin = securityUtils.getCurrentAdmin();
        Long selectedBranchId = securityUtils.getCurrentBranchId();
        if (selectedBranchId == null) {
            return "Please select a branch before requesting business data.";
        }

        Branch selectedBranch = branchRepository.findByIdAndAdminId(selectedBranchId, admin.getId()).orElse(null);
        if (selectedBranch == null) {
            return "The selected branch was not found for your account.";
        }

        List<Branch> branches = requestedBranches(question, admin, selectedBranch);
        Optional<String> databaseAnswer = answerBusinessQuestion(question, admin, branches);
        if (databaseAnswer.isPresent()) {
            return humanizeDatabaseAnswer(databaseAnswer.get());
        }

        return callGemini(question, history);
    }

    private List<Branch> requestedBranches(String question, Admin admin, Branch selectedBranch) {
        boolean allBranchesRequested = question.toLowerCase(Locale.ROOT).matches(".*\\ball\\s+branches?\\b.*");
        if (allBranchesRequested && hasRole("ROLE_ADMIN")) {
            return branchRepository.findAllByAdminId(admin.getId());
        }
        return List.of(selectedBranch);
    }

    private Optional<String> answerBusinessQuestion(String question, Admin admin, List<Branch> branches) {
        String text = question.toLowerCase(Locale.ROOT);

        // Exclude general "how-to", setup, or help questions from triggering database data dumps
        if (containsAny(text, "how to", "how do i", "how can i", "steps to", "help", "guide", "process", "procedure",
                "add product", "create product", "register product", "enter product", "new product",
                "add branch", "create branch", "register branch",
                "make return", "do return", "create return", "process return",
                "how do returns work", "how do refunds work", "how do exchanges work")) {
            return Optional.empty();
        }

        String scope = branches.size() == 1 ? branches.get(0).getName() : "All Branches";

        if (containsAny(text, "sale", "revenue", "collection", "business", "profit", "invoice", "bill", "highest sales", "lowest sales")) {
            String invoiceNumber = extractInvoiceNumber(question);
            if (invoiceNumber != null) {
                return Optional.of(invoiceDetails(admin, branches, invoiceNumber));
            }
            return Optional.of(salesReport(admin, branches, scope, periodFor(text), text));
        }
        if (containsAny(text, "return", "refund", "exchange")) {
            return Optional.of(returnReport(admin, branches, scope));
        }
        if (containsAny(text, "theft", "stolen", "missing", "loss")) {
            return Optional.of(theftReport(admin, branches, scope, text));
        }
        if (containsAny(text, "damage", "damaged", "broken", "defective")) {
            return Optional.of(damageReport(admin, branches, scope));
        }
        if (containsAny(text, "supplier", "supply request", "dispatch", "delivery", "incoming")) {
            return Optional.of(supplierReport(admin, branches, scope));
        }
        if (containsAny(text, "customer", "customers")) {
            return Optional.of(customerReport(admin, branches, scope, text));
        }
        if (containsAny(text, "staff", "who billed", "performance")) {
            return Optional.of(staffReport(admin, branches, scope, periodFor(text)));
        }
        if (containsAny(text, "stock", "inventory", "product", "products", "expiry", "expire", "batch", "category")) {
            if (text.contains("product detail") || text.contains("details of") || text.contains("details for")) {
                return Optional.of(productDetails(admin, branches, scope, question));
            }
            return Optional.of(inventoryReport(admin, branches, scope, text));
        }
        return Optional.empty();
    }

    private String salesReport(Admin admin, List<Branch> branches, String scope, DatePeriod period, String text) {
        List<Invoice> invoices = invoicesFor(admin, branches, period);
        List<Invoice> paidInvoices = invoices.stream().filter(invoice -> invoice.getStatus() == Invoice.InvoiceStatus.PAID).toList();
        BigDecimal revenue = paidInvoices.stream().map(Invoice::getTotalAmount).filter(amount -> amount != null).reduce(BigDecimal.ZERO, BigDecimal::add);
        int units = paidInvoices.stream().flatMap(invoice -> invoice.getItems().stream()).mapToInt(item -> safe(item.getQuantity())).sum();
        BigDecimal profit = paidInvoices.stream().flatMap(invoice -> invoice.getItems().stream()).map(this::profitFor).reduce(BigDecimal.ZERO, BigDecimal::add);

        if (paidInvoices.isEmpty()) {
            return "No records found for the selected period.\n\nScope: " + scope + " | Period: " + period.label;
        }

        Map<String, Integer> sold = new HashMap<>();
        paidInvoices.forEach(invoice -> invoice.getItems().forEach(item -> sold.merge(item.getProductName(), safe(item.getQuantity()), Integer::sum)));
        String topProduct = sold.entrySet().stream().max(Map.Entry.comparingByValue()).map(entry -> entry.getKey() + " (" + entry.getValue() + " units)").orElse("Not available");
        long lowStock = productsFor(admin, branches).stream().filter(Product::isLowStock).count();
        String title = period.label + " Sales Summary";
        StringBuilder answer = new StringBuilder(title)
                .append("\n\nScope: ").append(scope)
                .append("\nPaid Invoices: ").append(paidInvoices.size())
                .append("\nProducts Sold: ").append(units)
                .append("\nRevenue: ").append(money(revenue))
                .append("\nEstimated Profit: ").append(money(profit))
                .append("\nTop Product: ").append(topProduct)
                .append("\nLow Stock Alerts: ").append(lowStock);
        if (text.contains("lowest sales")) {
            dailyExtremes(paidInvoices, false).ifPresent(value -> answer.append("\nLowest Sales Day: ").append(value));
        } else if (text.contains("highest sales")) {
            dailyExtremes(paidInvoices, true).ifPresent(value -> answer.append("\nHighest Sales Day: ").append(value));
        }
        return answer.toString();
    }

    private String inventoryReport(Admin admin, List<Branch> branches, String scope, String text) {
        List<Product> products = productsFor(admin, branches);
        List<ProductBatch> batches = batchesFor(admin, branches);
        if (products.isEmpty() && batches.isEmpty()) {
            return "No records found for the selected branch.";
        }
        List<Product> low = products.stream().filter(Product::isLowStock).toList();
        List<Product> out = products.stream().filter(product -> safe(product.getCurrentStock()) == 0).toList();
        LocalDate today = LocalDate.now();
        List<ProductBatch> expired = batches.stream().filter(batch -> batch.getExpiryDate() != null && batch.getExpiryDate().isBefore(today) && safe(batch.getQuantityRemaining()) > 0).toList();
        List<ProductBatch> nearExpiry = batches.stream().filter(batch -> batch.getExpiryDate() != null && !batch.getExpiryDate().isBefore(today) && !batch.getExpiryDate().isAfter(today.plusDays(30)) && safe(batch.getQuantityRemaining()) > 0).toList();
        long totalStock = products.stream().mapToLong(product -> safe(product.getCurrentStock())).sum();
        BigDecimal inventoryValue = products.stream().map(product -> value(product.getPurchasePrice(), safe(product.getCurrentStock()))).reduce(BigDecimal.ZERO, BigDecimal::add);

        if (text.contains("out of stock")) {
            return productList("Out of Stock Products", scope, out, 10);
        }
        if (text.contains("low stock")) {
            return productList("Low Stock Products", scope, low, 10);
        }
        if (text.contains("expired")) {
            return batchList("Expired Products", scope, expired);
        }
        if (text.contains("near expiry") || text.contains("expiring")) {
            return batchList("Near Expiry Products", scope, nearExpiry);
        }

        return "Inventory Summary\n\nScope: " + scope
                + "\nProducts: " + products.size()
                + "\nAvailable Stock: " + totalStock
                + "\nInventory Value: " + money(inventoryValue)
                + "\nLow Stock Products: " + low.size()
                + "\nOut of Stock Products: " + out.size()
                + "\nNear Expiry Batches: " + nearExpiry.size()
                + "\nExpired Batches: " + expired.size();
    }

    private String productDetails(Admin admin, List<Branch> branches, String scope, String question) {
        String name = question.replaceFirst("(?i).*?(?:product details?|details of|details for)\\s*(?:for|of)?\\s*", "").trim();
        if (name.isBlank() || name.equalsIgnoreCase("product")) {
            return "Please include the product name, for example: Product details for Milk.";
        }
        List<Product> matches = productsFor(admin, branches).stream()
                .filter(product -> product.getName().toLowerCase(Locale.ROOT).contains(name.toLowerCase(Locale.ROOT)))
                .limit(5).toList();
        if (matches.isEmpty()) return "No product found with that name in the selected branch.";
        StringBuilder response = new StringBuilder("Product Details\n\nScope: ").append(scope);
        matches.forEach(product -> response.append("\n\nName: ").append(product.getName())
                .append("\nBarcode: ").append(product.getBarcode() == null ? "Not recorded" : product.getBarcode())
                .append("\nCategory: ").append(product.getCategory())
                .append("\nAvailable Stock: ").append(safe(product.getCurrentStock()))
                .append("\nSelling Price: ").append(money(product.getSellingPrice()))
                .append("\nStatus: ").append(product.getStatus()));
        return response.toString();
    }

    private String customerReport(Admin admin, List<Branch> branches, String scope, String text) {
        List<Invoice> invoices = invoicesFor(admin, branches, DatePeriod.ALL);
        Map<String, BigDecimal> spend = new HashMap<>();
        invoices.stream().filter(invoice -> invoice.getCustomer() != null && invoice.getStatus() == Invoice.InvoiceStatus.PAID)
                .forEach(invoice -> spend.merge(invoice.getCustomer().getName(), invoice.getTotalAmount(), BigDecimal::add));
        long customers = branches.stream().mapToLong(branch -> customerRepository.findByAdminIdAndBranchId(admin.getId(), branch.getId()).size()).sum();
        if (text.contains("purchase history") || text.contains("top customer") || text.contains("highest spending") || text.contains("frequent")) {
            if (spend.isEmpty()) return "No records found for the selected period.";
            String customer = spend.entrySet().stream().max(Map.Entry.comparingByValue()).map(entry -> entry.getKey() + " — " + money(entry.getValue())).orElse("Not available");
            return "Customer Summary\n\nScope: " + scope + "\nTop Customer: " + customer + "\nCustomers with Purchases: " + spend.size();
        }
        return "Customer Summary\n\nScope: " + scope + "\nTotal Customers: " + customers + "\nCustomers with Purchases: " + spend.size();
    }

    private String supplierReport(Admin admin, List<Branch> branches, String scope) {
        List<SupplyRequest> requests = new ArrayList<>();
        List<SupplierDispatch> dispatches = new ArrayList<>();
        for (Branch branch : branches) {
            requests.addAll(supplyRequestRepository.findAllByAdminAndBranchOrderByCreatedAtDesc(admin, branch));
            dispatches.addAll(supplierDispatchRepository.findAllByAdminAndBranchOrderByDispatchDateDesc(admin, branch));
        }
        long pendingRequests = requests.stream().filter(request -> request.getStatus() == SupplyRequest.RequestStatus.PENDING).count();
        long acceptedRequests = requests.stream().filter(request -> request.getStatus() == SupplyRequest.RequestStatus.ACCEPTED).count();
        long pendingDispatches = dispatches.stream().filter(dispatch -> "PENDING".equalsIgnoreCase(dispatch.getStatus())).count();
        return "Supplier & Supply Summary\n\nScope: " + scope
                + "\nPending Supply Requests: " + pendingRequests
                + "\nAccepted Supply Requests: " + acceptedRequests
                + "\nPending Deliveries: " + pendingDispatches
                + "\nTotal Dispatches: " + dispatches.size();
    }

    private String returnReport(Admin admin, List<Branch> branches, String scope) {
        List<ProductReturn> returns = new ArrayList<>();
        for (Branch branch : branches) returns.addAll(productReturnRepository.findByAdminIdAndBranchIdOrderByCreatedAtDesc(admin.getId(), branch.getId()));
        if (returns.isEmpty()) return "No records found for the selected period.";
        long customerReturns = returns.stream().filter(returnRecord -> "CUSTOMER_TO_OWNER".equals(returnRecord.getReturnType())).count();
        long supplierReturns = returns.size() - customerReturns;
        BigDecimal refunded = returns.stream().map(ProductReturn::getRefundAmount).filter(amount -> amount != null).reduce(BigDecimal.ZERO, BigDecimal::add);
        return "Return Summary\n\nScope: " + scope + "\nCustomer Returns: " + customerReturns + "\nSupplier Returns: " + supplierReturns + "\nRefunded Amount: " + money(refunded);
    }

    private String theftReport(Admin admin, List<Branch> branches, String scope, String text) {
        List<TheftRecord> thefts = new ArrayList<>();
        for (Branch branch : branches) thefts.addAll(theftRecordRepository.findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(admin.getId(), branch.getId()));
        if (text.contains("today")) thefts = thefts.stream().filter(theft -> LocalDate.now().equals(theft.getDetectionDate())).toList();
        if (thefts.isEmpty()) return "No records found for the selected period.";
        BigDecimal loss = thefts.stream().map(TheftRecord::getLossValue).filter(amount -> amount != null).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Integer> missing = new HashMap<>();
        thefts.forEach(theft -> missing.merge(theft.getProductName(), safe(theft.getUnexplainedLoss()), Integer::sum));
        String product = missing.entrySet().stream().max(Map.Entry.comparingByValue()).map(entry -> entry.getKey() + " (" + entry.getValue() + " missing)").orElse("Not available");
        return "Theft & Loss Summary\n\nScope: " + scope + "\nTheft Records: " + thefts.size() + "\nLoss Value: " + money(loss) + "\nMost Affected Product: " + product;
    }

    private String damageReport(Admin admin, List<Branch> branches, String scope) {
        List<DamageRecord> damages = new ArrayList<>();
        for (Branch branch : branches) damages.addAll(damageRecordRepository.findByAdminIdAndBranchIdOrderByCreatedAtDesc(admin.getId(), branch.getId()));
        if (damages.isEmpty()) return "No records found for the selected period.";
        int quantity = damages.stream().mapToInt(damage -> safe(damage.getQuantity())).sum();
        return "Damage Summary\n\nScope: " + scope + "\nDamage Records: " + damages.size() + "\nDamaged Units: " + quantity;
    }

    private String staffReport(Admin admin, List<Branch> branches, String scope, DatePeriod period) {
        List<Invoice> invoices = invoicesFor(admin, branches, period).stream().filter(invoice -> invoice.getStatus() == Invoice.InvoiceStatus.PAID && invoice.getStaff() != null).toList();
        if (invoices.isEmpty()) return "No records found for the selected period.";
        Map<String, BigDecimal> sales = new HashMap<>();
        Map<String, Integer> billed = new HashMap<>();
        for (Invoice invoice : invoices) {
            String staffName = invoice.getStaff().getFullName();
            sales.merge(staffName, invoice.getTotalAmount(), BigDecimal::add);
            billed.merge(staffName, 1, Integer::sum);
        }
        String leader = sales.entrySet().stream().max(Map.Entry.comparingByValue()).map(entry -> entry.getKey() + " — " + money(entry.getValue())).orElse("Not available");
        return period.label + " Staff Performance\n\nScope: " + scope + "\nActive Billing Staff: " + sales.size() + "\nTop Biller: " + leader + "\nInvoices Generated: " + invoices.size();
    }

    private String invoiceDetails(Admin admin, List<Branch> branches, String invoiceNumber) {
        for (Branch branch : branches) {
            Optional<Invoice> invoice = invoiceRepository.findByInvoiceNumberAndAdminIdAndBranchId(invoiceNumber, admin.getId(), branch.getId());
            if (invoice.isPresent()) {
                Invoice value = invoice.get();
                String items = value.getItems().stream().map(item -> item.getProductName() + " x" + item.getQuantity()).reduce((first, second) -> first + ", " + second).orElse("No items");
                return "Invoice Details\n\nInvoice: " + value.getInvoiceNumber() + "\nBranch: " + branch.getName() + "\nStatus: " + value.getStatus() + "\nTotal: " + money(value.getTotalAmount()) + "\nItems: " + items;
            }
        }
        return "Invoice not found in the selected branch scope.";
    }

    private String answerSupplierQuestion(String question) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Supplier supplier = supplierRepository.findByEmail(authentication.getName()).orElse(null);
        if (supplier == null) return "Supplier account details were not found.";
        String text = question.toLowerCase(Locale.ROOT);
        if (!containsAny(text, "supplier", "supply", "request", "dispatch", "delivery", "return", "product", "catalog")) {
            return "Supplier accounts can access only supplier-related products, supply requests, dispatches, and returns.";
        }
        List<SupplyRequest> requests = supplyRequestRepository.findAllBySupplierOrderByCreatedAtDesc(supplier);
        List<SupplierDispatch> dispatches = supplierDispatchRepository.findAllBySupplierOrderByDispatchDateDesc(supplier);
        long pending = requests.stream().filter(request -> request.getStatus() == SupplyRequest.RequestStatus.PENDING).count();
        return "Supplier Summary\n\nPending Supply Requests: " + pending + "\nTotal Supply Requests: " + requests.size() + "\nTotal Dispatches: " + dispatches.size();
    }

    private List<Invoice> invoicesFor(Admin admin, List<Branch> branches, DatePeriod period) {
        List<Invoice> invoices = new ArrayList<>();
        for (Branch branch : branches) {
            if (period == DatePeriod.ALL) invoices.addAll(invoiceRepository.findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(admin.getId(), branch.getId()));
            else invoices.addAll(invoiceRepository.findByAdminIdAndBranchIdAndDateRange(admin.getId(), branch.getId(), period.start, period.end));
        }
        return invoices;
    }

    private List<Product> productsFor(Admin admin, List<Branch> branches) {
        List<Product> products = new ArrayList<>();
        for (Branch branch : branches) products.addAll(productRepository.findByAdminIdAndBranchId(admin.getId(), branch.getId()));
        return products;
    }

    private List<ProductBatch> batchesFor(Admin admin, List<Branch> branches) {
        List<ProductBatch> batches = new ArrayList<>();
        for (Branch branch : branches) batches.addAll(productBatchRepository.findAllByAdminAndBranchOrderByCreatedAtDesc(admin, branch));
        return batches;
    }

    private DatePeriod periodFor(String text) {
        LocalDate today = LocalDate.now();
        if (text.contains("yesterday")) return DatePeriod.of("Yesterday", today.minusDays(1), today.minusDays(1));
        if (text.contains("week") || text.contains("weekly")) return DatePeriod.of("This Week", today.with(DayOfWeek.MONDAY), today);
        if (text.contains("month") || text.contains("monthly")) return DatePeriod.of("This Month", today.withDayOfMonth(1), today);
        if (text.contains("annual") || text.contains("year") || text.contains("yearly")) return DatePeriod.of("This Year", today.withDayOfYear(1), today);
        if (text.contains("total") || text.contains("all time")) return DatePeriod.ALL;
        return DatePeriod.of("Today", today, today);
    }

    private Optional<String> dailyExtremes(List<Invoice> invoices, boolean highest) {
        Map<LocalDate, BigDecimal> totals = new HashMap<>();
        invoices.forEach(invoice -> totals.merge(invoice.getCreatedAt().toLocalDate(), invoice.getTotalAmount(), BigDecimal::add));
        Comparator<Map.Entry<LocalDate, BigDecimal>> comparator = Map.Entry.comparingByValue();
        return (highest ? totals.entrySet().stream().max(comparator) : totals.entrySet().stream().min(comparator))
                .map(entry -> entry.getKey() + " — " + money(entry.getValue()));
    }

    private String productList(String title, String scope, List<Product> products, int limit) {
        if (products.isEmpty()) return "No records found for the selected branch.";
        StringBuilder answer = new StringBuilder(title).append("\n\nScope: ").append(scope);
        products.stream().limit(limit).forEach(product -> answer.append("\n- ").append(product.getName()).append(": ").append(safe(product.getCurrentStock())).append(" in stock"));
        return answer.toString();
    }

    private String batchList(String title, String scope, List<ProductBatch> batches) {
        if (batches.isEmpty()) return "No records found for the selected period.";
        StringBuilder answer = new StringBuilder(title).append("\n\nScope: ").append(scope);
        batches.stream().limit(10).forEach(batch -> answer.append("\n- ").append(batch.getProduct().getName()).append(" | Batch ").append(batch.getBatchNumber()).append(" | Expiry: ").append(batch.getExpiryDate()).append(" | Available: ").append(safe(batch.getQuantityRemaining())));
        return answer.toString();
    }

    private BigDecimal profitFor(InvoiceItem item) {
        BigDecimal sales = value(item.getUnitPrice(), safe(item.getQuantity()));
        BigDecimal cost = item.getProduct() == null ? BigDecimal.ZERO : value(item.getProduct().getPurchasePrice(), safe(item.getQuantity()));
        return sales.subtract(cost);
    }

    private BigDecimal value(BigDecimal amount, int quantity) { return (amount == null ? BigDecimal.ZERO : amount).multiply(BigDecimal.valueOf(quantity)); }
    private int safe(Integer value) { return value == null ? 0 : value; }
    private String money(BigDecimal value) { return "₹" + (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP).toPlainString(); }
    private boolean containsAny(String text, String... keywords) { for (String keyword : keywords) if (text.contains(keyword)) return true; return false; }
    private boolean hasRole(String role) { Authentication auth = SecurityContextHolder.getContext().getAuthentication(); return auth != null && auth.getAuthorities().stream().anyMatch(authority -> role.equals(authority.getAuthority())); }

    private String extractInvoiceNumber(String question) {
        Matcher matcher = INVOICE_NUMBER_PATTERN.matcher(question);
        if (!matcher.find()) return null;
        String value = matcher.group(1);
        return value.length() < 2 || "details".equalsIgnoreCase(value) || "summary".equalsIgnoreCase(value) ? null : value;
    }

    private String callGemini(String userMessage, List<Map<String, String>> history) {
        String systemInstruction = "You are the AI Smart Inventory assistant. "
                + "Answer general inventory questions and explain how to use the system's features clearly and concisely. "
                + "Here is how to use key features in this system:\n"
                + "- To add a product: Go to the 'Products' page, click 'Add Product', enter product details (Name, Category, Stock, Prices, and Barcode), and click Save.\n"
                + "- To return a product: Go to the 'Returns' page. Search for the invoice using the Invoice Number, choose the product, specify return quantity and condition (Good or Damaged). If Damaged, upload/capture evidence photos. Once approved, select Refund (returns money) or Exchange (select a replacement item).\n"
                + "- To run stock verification: Go to the 'Verification' page and scan barcodes using the camera or enter them manually to match actual stock against database expectations.\n"
                + "- To view theft reports: Go to the 'Theft Detection' page to see records of unexplained losses and daily stock verification alerts.\n"
                + "Do not claim to know live business figures unless they are supplied in the prompt context. Be friendly and helpful.";
        String reply = requestGemini(systemInstruction, userMessage);
        return reply == null ? localHelpResponse(userMessage) : reply;
    }

    private String localHelpResponse(String question) {
        String text = question.toLowerCase(Locale.ROOT);
        if (containsAny(text, "enter product", "add product", "create product", "register product")) {
            return "To enter a product, open Products, select Add Product, enter the product details (or scan its barcode), then save it. "
                    + "Ensure the selected branch is correct before saving so the product is added to that branch only.";
        }
        return "The AI service is temporarily busy. You can still ask for live sales, inventory, customer, supplier, invoice, return, theft, damage, and staff reports for the selected branch.";
    }

    private String humanizeDatabaseAnswer(String databaseAnswer) {
        String instruction = "You are a professional inventory reporting assistant. Rewrite the supplied live database report clearly and concisely. "
                + "Do not change, omit, infer, or add any value, date, name, or metric. If it says no records, keep that exact conclusion.";
        String reply = requestGemini(instruction, databaseAnswer);
        return reply == null ? databaseAnswer : reply;
    }

    private String requestGemini(String instruction, String content) {
        String apiKey = getGeminiApiKey();
        if (apiKey == null || apiKey.isBlank()) return null;

        try {
            String payload = "{\"system_instruction\":{\"parts\":[{\"text\":\"" + escapeJson(instruction) + "\"}]},"
                    + "\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":\"" + escapeJson(content) + "\"}]}],"
                    + "\"generationConfig\":{\"temperature\":0.1,\"maxOutputTokens\":1024}}";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                log.warn("Gemini response status: {}", response.statusCode());
                return null;
            }
            return extractGeminiText(response.body());
        } catch (Exception exception) {
            log.warn("Gemini is unavailable; returning the database summary directly: {}", exception.getMessage());
            return null;
        }
    }

    private String extractGeminiText(String response) {
        int textIndex = response.indexOf("\"text\":");
        if (textIndex < 0) return null;
        int start = response.indexOf('"', textIndex + 7);
        if (start < 0) return null;
        int end = start + 1;
        while (end < response.length()) {
            end = response.indexOf('"', end);
            if (end < 0) return null;
            if (response.charAt(end - 1) != '\\') break;
            end++;
        }
        return unescapeJson(response.substring(start + 1, end));
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    private String unescapeJson(String value) {
        return value.replace("\\n", "\n").replace("\\\"", "\"").replace("\\\\", "\\").replace("\\r", "\r").replace("\\t", "\t");
    }

    private String getGeminiApiKey() {
        String key = System.getenv("GEMINI_API_KEY");
        if (key == null || key.isBlank()) key = System.getenv("VITE_GEMINI_API_KEY");
        if (key != null && !key.isBlank()) return key;
        try {
            Path environmentFile = Path.of("../frontend/.env");
            if (Files.exists(environmentFile)) {
                return Files.readAllLines(environmentFile).stream()
                        .filter(line -> line.trim().startsWith("VITE_GEMINI_API_KEY="))
                        .map(line -> line.split("=", 2)[1].trim())
                        .findFirst()
                        .orElse("");
            }
        } catch (Exception exception) {
            log.warn("Unable to read Gemini configuration: {}", exception.getMessage());
        }
        return "";
    }

    private static final class DatePeriod {
        private static final DatePeriod ALL = new DatePeriod("All Time", null, null);
        private final String label;
        private final LocalDateTime start;
        private final LocalDateTime end;

        private DatePeriod(String label, LocalDateTime start, LocalDateTime end) { this.label = label; this.start = start; this.end = end; }
        private static DatePeriod of(String label, LocalDate start, LocalDate end) { return new DatePeriod(label, start.atStartOfDay(), end.atTime(LocalTime.MAX)); }
    }
}
