package com.smartinventory.service;

import com.smartinventory.dto.request.DamageRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.DamageResponse;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.DamageRecord;
import com.smartinventory.entity.Product;
import com.smartinventory.exception.BadRequestException;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.DamageRecordRepository;
import com.smartinventory.repository.ProductRepository;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DamageService {

    private final DamageRecordRepository damageRecordRepository;
    private final ProductRepository productRepository;
    private final SecurityUtils securityUtils;

    @Transactional
    public ApiResponse<DamageResponse> recordDamage(DamageRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();

        Product product = productRepository.findByIdAndAdminId(request.getProductId(), admin.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Product", request.getProductId()));

        if (product.getCurrentStock() < request.getQuantity()) {
            throw new BadRequestException(
                "Damage quantity (" + request.getQuantity() + ") exceeds current stock ("
                + product.getCurrentStock() + ") for product: " + product.getName());
        }

        DamageRecord.DamageReason reason;
        try {
            reason = DamageRecord.DamageReason.valueOf(request.getReason().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid damage reason: " + request.getReason() +
                ". Valid values: BROKEN, EXPIRED, DEFECTIVE, OTHER");
        }

        LocalDate damageDate = request.getDamageDate() != null
                ? request.getDamageDate() : LocalDate.now();

        DamageRecord record = DamageRecord.builder()
                .admin(admin)
                .product(product)
                .productName(product.getName())
                .quantity(request.getQuantity())
                .reason(reason)
                .notes(request.getNotes())
                .damageDate(damageDate)
                .build();

        record = damageRecordRepository.save(record);

        // Deduct damaged quantity from stock — damage is NOT theft
        product.setCurrentStock(product.getCurrentStock() - request.getQuantity());
        productRepository.save(product);

        log.info("Damage recorded for product '{}': {} units ({})",
                product.getName(), request.getQuantity(), reason);

        return ApiResponse.success(
            "Damage recorded successfully. " + request.getQuantity() +
            " unit(s) of '" + product.getName() + "' deducted from inventory.",
            mapToResponse(record));
    }

    public ApiResponse<List<DamageResponse>> getAllDamageRecords() {
        Long adminId = securityUtils.getCurrentAdminId();
        List<DamageResponse> records = damageRecordRepository
                .findByAdminIdOrderByCreatedAtDesc(adminId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Damage records retrieved", records);
    }

    public ApiResponse<List<DamageResponse>> getDamageByDate(LocalDate date) {
        Long adminId = securityUtils.getCurrentAdminId();
        List<DamageResponse> records = damageRecordRepository
                .findByAdminIdAndDamageDateOrderByCreatedAtDesc(adminId, date)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Damage records for " + date, records);
    }

    public ApiResponse<List<DamageResponse>> getDamageByDateRange(LocalDate from, LocalDate to) {
        Long adminId = securityUtils.getCurrentAdminId();
        List<DamageResponse> records = damageRecordRepository
                .findByAdminIdAndDamageDateBetweenOrderByDamageDateDesc(adminId, from, to)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Damage records retrieved", records);
    }

    public ApiResponse<List<DamageResponse>> getProductDamageHistory(Long productId) {
        Long adminId = securityUtils.getCurrentAdminId();
        List<DamageResponse> records = damageRecordRepository
                .findByAdminIdAndProductIdOrderByCreatedAtDesc(adminId, productId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Product damage history", records);
    }

    public DamageResponse mapToResponse(DamageRecord d) {
        return DamageResponse.builder()
                .id(d.getId())
                .productId(d.getProduct() != null ? d.getProduct().getId() : null)
                .productName(d.getProductName())
                .quantity(d.getQuantity())
                .reason(d.getReason().name())
                .notes(d.getNotes())
                .damageDate(d.getDamageDate())
                .createdAt(d.getCreatedAt())
                .build();
    }
}
