package com.smartinventory.dto.response;

import com.smartinventory.entity.Supplier;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SupplierResponse {
    private Long id;
    private String companyName;
    private String supplierName;
    private String email;
    private String phoneNumber;
    private String address;
    private String location;
    private boolean emailVerified;
    private boolean active;
    private LocalDateTime createdAt;

    public static SupplierResponse from(Supplier s) {
        return SupplierResponse.builder()
                .id(s.getId())
                .companyName(s.getCompanyName())
                .supplierName(s.getSupplierName())
                .email(s.getEmail())
                .phoneNumber(s.getPhoneNumber())
                .address(s.getAddress())
                .location(s.getLocation())
                .emailVerified(s.isEmailVerified())
                .active(s.isActive())
                .createdAt(s.getCreatedAt())
                .build();
    }
}
