package com.smartinventory.service;

import com.smartinventory.dto.request.DiscountRequest;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.DiscountResponse;
import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Discount;
import com.smartinventory.exception.DuplicateResourceException;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.DiscountRepository;
import com.smartinventory.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiscountService {

    private final DiscountRepository discountRepository;
    private final SecurityUtils securityUtils;

    public ApiResponse<List<DiscountResponse>> getAllDiscounts() {
        Long adminId = securityUtils.getCurrentAdminId();
        List<DiscountResponse> discounts = discountRepository.findByAdminId(adminId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Discounts retrieved", discounts);
    }

    public ApiResponse<List<DiscountResponse>> getActiveDiscounts() {
        Long adminId = securityUtils.getCurrentAdminId();
        List<DiscountResponse> discounts = discountRepository.findByAdminIdAndActiveTrue(adminId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
        return ApiResponse.success("Active discounts retrieved", discounts);
    }

    public ApiResponse<DiscountResponse> getDiscountById(Long id) {
        Discount discount = findByIdAndAdmin(id);
        return ApiResponse.success("Discount retrieved", mapToResponse(discount));
    }

    @Transactional
    public ApiResponse<DiscountResponse> createDiscount(DiscountRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();
        if (discountRepository.existsByNameAndAdminId(request.getName(), admin.getId())) {
            throw new DuplicateResourceException("Discount '" + request.getName() + "' already exists");
        }
        Discount discount = Discount.builder()
                .admin(admin)
                .name(request.getName())
                .percentage(request.getPercentage())
                .minimumPurchaseAmount(
                        request.getMinimumPurchaseAmount() != null
                                ? request.getMinimumPurchaseAmount()
                                : java.math.BigDecimal.ZERO)
                .description(request.getDescription())
                .active(request.isActive())
                .build();
        discount = discountRepository.save(discount);
        return ApiResponse.success("Discount created successfully", mapToResponse(discount));
    }

    @Transactional
    public ApiResponse<DiscountResponse> updateDiscount(Long id, DiscountRequest request) {
        Admin admin = securityUtils.getCurrentAdmin();
        Discount discount = findByIdAndAdmin(id);
        if (discountRepository.existsByNameAndAdminIdAndIdNot(request.getName(), admin.getId(), id)) {
            throw new DuplicateResourceException("Discount '" + request.getName() + "' already exists");
        }
        discount.setName(request.getName());
        discount.setPercentage(request.getPercentage());
        discount.setMinimumPurchaseAmount(
                request.getMinimumPurchaseAmount() != null
                        ? request.getMinimumPurchaseAmount()
                        : java.math.BigDecimal.ZERO);
        discount.setDescription(request.getDescription());
        discount.setActive(request.isActive());
        discount = discountRepository.save(discount);
        return ApiResponse.success("Discount updated successfully", mapToResponse(discount));
    }

    @Transactional
    public ApiResponse<String> deleteDiscount(Long id) {
        Discount discount = findByIdAndAdmin(id);
        discountRepository.delete(discount);
        return ApiResponse.success("Discount deleted successfully");
    }

    private Discount findByIdAndAdmin(Long id) {
        Long adminId = securityUtils.getCurrentAdminId();
        return discountRepository.findByIdAndAdminId(id, adminId)
                .orElseThrow(() -> new ResourceNotFoundException("Discount", id));
    }

    public DiscountResponse mapToResponse(Discount discount) {
        return DiscountResponse.builder()
                .id(discount.getId())
                .name(discount.getName())
                .percentage(discount.getPercentage())
                .minimumPurchaseAmount(discount.getMinimumPurchaseAmount())
                .description(discount.getDescription())
                .active(discount.isActive())
                .createdAt(discount.getCreatedAt())
                .updatedAt(discount.getUpdatedAt())
                .build();
    }
}
