package com.smartinventory.service;

import com.smartinventory.dto.request.StockVerificationRequest;
import com.smartinventory.dto.request.TheftRecordNotesRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.LossVerificationResponse;
import com.smartinventory.dto.response.TheftRecordResponse;
import com.smartinventory.email.EmailService;
import com.smartinventory.entity.*;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.*;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TheftDetectionService {

    private final TheftRecordRepository theftRecordRepository;
    private final ProductRepository productRepository;
    private final InvoiceItemRepository invoiceItemRepository;
    private final StockVerificationRepository stockVerificationRepository;
    private final AdminRepository adminRepository;
    private final DamageRecordRepository damageRecordRepository;
    private final EmailService emailService;
    private final SecurityUtils securityUtils;
    private final BranchRepository branchRepository;
    private final TheftRiskService theftRiskService;

    /**
     * Enhanced stock verification:
     * 1. Computes expectedStock = openingStock - soldQty
     * 2. Subtracts recorded damages for today
     * 3. Remaining difference = unexplained loss → flagged as "Possible Inventory Loss"
     * 4. Sends enhanced email with damage breakdown
     */
    @Transactional
    public ApiResponse<List<TheftRecordResponse>> verifyStock(StockVerificationRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(admin.getId());
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        Branch activeBranch = null;
        if (branchId != null) {
            activeBranch = branchRepository.findByIdAndAdminId(branchId, admin.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + branchId));
        }

        LocalDate today = LocalDate.now();
        LocalDateTime dayStart = today.atStartOfDay();
        LocalDateTime dayEnd   = today.atTime(LocalTime.MAX);

        List<TheftRecord> records = new ArrayList<>();

        for (StockVerificationRequest.StockEntry entry : request.getEntries()) {
            Product product = productRepository.findByIdAndAdminIdAndBranchId(entry.getProductId(), admin.getId(), branchId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product", entry.getProductId()));

            if (branchId != null && product.getBranch() != null && !product.getBranch().getId().equals(branchId)) {
                throw new RuntimeException("Product " + product.getName() + " does not belong to the active branch.");
            }

            Integer soldToday = invoiceItemRepository
                    .sumSoldQuantityByProductAndAdminAndDateRange(
                            entry.getProductId(), admin.getId(), dayStart, dayEnd);
            if (soldToday == null) soldToday = 0;

            // Total damage recorded for this product today
            Integer damagedToday = damageRecordRepository
                    .sumDamageByProductAndBranchAndDate(admin.getId(), branchId, entry.getProductId(), today);
            if (damagedToday == null) damagedToday = 0;

            int expectedStock  = product.getOpeningStock() - soldToday;
            int difference     = expectedStock - entry.getActualStock(); // total missing
            int unexplainedLoss = Math.max(0, difference - damagedToday); // after subtracting recorded damage

            // Only save a record if there is any difference (explained or unexplained)
            if (difference > 0 && !theftRecordRepository
                    .existsByAdminIdAndBranchIdAndProductIdAndDetectionDate(
                            admin.getId(), branchId, entry.getProductId(), today)) {

                BigDecimal lossValue = product.getSellingPrice()
                        .multiply(BigDecimal.valueOf(unexplainedLoss));

                TheftRecord.TheftStatus status = unexplainedLoss > 0
                        ? TheftRecord.TheftStatus.DETECTED
                        : TheftRecord.TheftStatus.NORMAL;

                TheftRecord record = TheftRecord.builder()
                        .admin(admin)
                        .branch(activeBranch)
                        .product(product)
                        .productName(product.getName())
                        .openingStock(product.getOpeningStock())
                        .soldQuantity(soldToday)
                        .expectedStock(expectedStock)
                        .actualStock(entry.getActualStock())
                        .missingQuantity(difference)
                        .damagedQuantity(damagedToday)
                        .unexplainedLoss(unexplainedLoss)
                        .lossValue(lossValue)
                        .detectionDate(today)
                        .status(status)
                        .adminNotes(entry.getAdminNotes())
                        .build();

                TheftRecord savedRecord = theftRecordRepository.save(record);
                records.add(savedRecord);

                // Send enhanced email only when unexplained loss > 0
                if (unexplainedLoss > 0) {
                    emailService.sendInventoryLossAlert(
                            admin.getEmail(), admin.getFullName(),
                            product.getName(), expectedStock, entry.getActualStock(),
                            damagedToday, unexplainedLoss, lossValue.doubleValue(), today);
                    theftRiskService.evaluateAfterPossibleLoss(savedRecord);
                }
            }

            // Update stock to verified actual
            product.setCurrentStock(entry.getActualStock());
            product.setOpeningStock(entry.getActualStock());
            productRepository.save(product);
        }

        StockVerification verification = null;
        if (branchId != null) {
            verification = stockVerificationRepository
                    .findByAdminIdAndBranchIdAndVerificationDate(admin.getId(), branchId, today)
                    .orElse(StockVerification.builder()
                            .admin(admin).branch(activeBranch).verificationDate(today).build());
        } else {
            verification = stockVerificationRepository
                    .findByAdminIdAndVerificationDate(admin.getId(), today)
                    .orElse(StockVerification.builder()
                            .admin(admin).verificationDate(today).build());
        }
        verification.setStatus(StockVerification.VerificationStatus.COMPLETED);
        verification.setCompletedAt(LocalDateTime.now());
        stockVerificationRepository.save(verification);

        long unexplainedCount = records.stream()
                .filter(r -> r.getUnexplainedLoss() > 0).count();

        String message = unexplainedCount == 0
                ? "Stock verified. No unexplained inventory loss detected."
                : unexplainedCount + " possible inventory loss record(s) detected.";

        return ApiResponse.success(message,
                records.stream().map(this::mapToResponse).collect(Collectors.toList()));
    }

    /**
     * Quick loss check without saving — shows expected vs actual vs damage for today.
     */
    public ApiResponse<List<LossVerificationResponse>> checkDailyLoss(
            List<Long> productIds, List<Integer> actualStocks) {

        Admin admin = securityUtils.getCurrentAdmin();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(admin.getId());
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        LocalDate today = LocalDate.now();
        LocalDateTime dayStart = today.atStartOfDay();
        LocalDateTime dayEnd   = today.atTime(LocalTime.MAX);

        List<LossVerificationResponse> results = new ArrayList<>();

        for (int i = 0; i < productIds.size(); i++) {
            Long productId = productIds.get(i);
            int actual     = actualStocks.get(i);

            Product product = productRepository.findByIdAndAdminIdAndBranchId(productId, admin.getId(), branchId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product", productId));

            if (branchId != null && product.getBranch() != null && !product.getBranch().getId().equals(branchId)) {
                throw new RuntimeException("Product " + product.getName() + " does not belong to the active branch.");
            }

            Integer sold    = invoiceItemRepository.sumSoldQuantityByProductAndAdminAndDateRange(
                    productId, admin.getId(), dayStart, dayEnd);
            if (sold == null) sold = 0;

            Integer damaged = damageRecordRepository.sumDamageByProductAndBranchAndDate(
                    admin.getId(), branchId, productId, today);
            if (damaged == null) damaged = 0;

            int expected      = product.getOpeningStock() - sold;
            int difference    = expected - actual;
            int unexplained   = Math.max(0, difference - damaged);

            BigDecimal unexplainedValue = product.getSellingPrice()
                    .multiply(BigDecimal.valueOf(unexplained));

            String status = unexplained > 0 ? "POSSIBLE_LOSS" : "NORMAL";

            results.add(LossVerificationResponse.builder()
                    .productId(productId)
                    .productName(product.getName())
                    .expectedStock(expected)
                    .actualStock(actual)
                    .damagedQuantity(damaged)
                    .difference(difference)
                    .unexplainedLoss(unexplained)
                    .unexplainedLossValue(unexplainedValue)
                    .status(status)
                    .verificationDate(today)
                    .build());
        }

        return ApiResponse.success("Loss check complete", results);
    }

    public ApiResponse<List<TheftRecordResponse>> getAllTheftRecords() {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<com.smartinventory.entity.TheftRecord> list = theftRecordRepository.findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(adminId, branchId);
        return ApiResponse.success("Loss records retrieved",
                list.stream().map(this::mapToResponse).collect(Collectors.toList()));
    }

    public ApiResponse<List<TheftRecordResponse>> getTheftRecordsByDate(LocalDate date) {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<TheftRecord> list = theftRecordRepository.findByAdminIdAndBranchIdAndDetectionDateOrderByCreatedAtDesc(adminId, branchId, date);
        return ApiResponse.success("Loss records for " + date,
                list.stream().map(this::mapToResponse).collect(Collectors.toList()));
    }

    public ApiResponse<List<TheftRecordResponse>> getTheftRecordsByDateRange(LocalDate from, LocalDate to) {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<TheftRecord> list = theftRecordRepository.findByAdminIdAndBranchIdAndDetectionDateBetweenOrderByDetectionDateDesc(adminId, branchId, from, to);
        return ApiResponse.success("Loss records retrieved",
                list.stream().map(this::mapToResponse).collect(Collectors.toList()));
    }

    @Transactional
    public ApiResponse<TheftRecordResponse> updateTheftNotes(Long id, TheftRecordNotesRequest request) {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        TheftRecord record = theftRecordRepository.findById(id)
                .filter(r -> r.getAdmin().getId().equals(adminId))
                .orElseThrow(() -> new ResourceNotFoundException("Loss record", id));
        if (branchId != null && record.getBranch() != null && !record.getBranch().getId().equals(branchId)) {
            throw new RuntimeException("Access denied: Loss record belongs to another branch.");
        }
        record.setAdminNotes(request.getAdminNotes());
        if (request.getStatus() != null) {
            record.setStatus(TheftRecord.TheftStatus.valueOf(request.getStatus()));
        }
        return ApiResponse.success("Updated", mapToResponse(theftRecordRepository.save(record)));
    }

    public ApiResponse<List<TheftRecordResponse>> getProductTheftHistory(Long productId) {
        Long adminId = securityUtils.getCurrentAdminId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (branchId == null) {
            List<Branch> branches = branchRepository.findAllByAdminId(adminId);
            if (!branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<TheftRecord> list = theftRecordRepository.findByAdminIdAndBranchIdAndProductId(adminId, branchId, productId);
        return ApiResponse.success("Product loss history",
                list.stream().map(this::mapToResponse).collect(Collectors.toList()));
    }

    public void sendDailyReminder() {
        adminRepository.findAll().forEach(admin -> {
            if (admin.isRegistrationComplete()) {
                emailService.sendStockVerificationReminder(admin.getEmail(), admin.getFullName());
                log.info("Daily reminder sent to: {}", admin.getEmail());
            }
        });
    }

    public TheftRecordResponse mapToResponse(TheftRecord r) {
        return TheftRecordResponse.builder()
                .id(r.getId())
                .productId(r.getProduct() != null ? r.getProduct().getId() : null)
                .productName(r.getProductName())
                .openingStock(r.getOpeningStock())
                .soldQuantity(r.getSoldQuantity())
                .expectedStock(r.getExpectedStock())
                .actualStock(r.getActualStock())
                .missingQuantity(r.getMissingQuantity())
                .damagedQuantity(r.getDamagedQuantity())
                .unexplainedLoss(r.getUnexplainedLoss())
                .lossValue(r.getLossValue())
                .detectionDate(r.getDetectionDate())
                .status(r.getStatus().name())
                .adminNotes(r.getAdminNotes())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
