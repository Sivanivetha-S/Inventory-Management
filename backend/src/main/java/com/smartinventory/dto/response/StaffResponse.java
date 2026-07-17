package com.smartinventory.dto.response;

import com.smartinventory.entity.Staff;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class StaffResponse {
    private Long id;
    private String fullName;
    private String email;
    private String username;
    private String phoneNumber;
    private String role;
    private boolean active;
    private boolean loginPermission;
    private boolean billingPermission;
    private boolean emailVerified;
    private LocalDateTime lastLoginTime;
    private long billsCreated;
    private LocalDateTime createdAt;
    private Long adminId;
    private String adminName;
    private Long branchId;
    private String branchName;

    public static StaffResponse from(Staff s) {
        return StaffResponse.builder()
                .id(s.getId())
                .fullName(s.getFullName())
                .email(s.getEmail())
                .username(s.getUsername())
                .phoneNumber(s.getPhoneNumber())
                .role(s.getRole().name())
                .active(s.isActive())
                .loginPermission(s.isLoginPermission())
                .billingPermission(s.isBillingPermission())
                .emailVerified(s.isEmailVerified())
                .lastLoginTime(s.getLastLoginTime())
                .createdAt(s.getCreatedAt())
                .adminId(s.getAdmin().getId())
                .adminName(s.getAdmin().getFullName())
                .branchId(s.getBranch() != null ? s.getBranch().getId() : null)
                .branchName(s.getBranch() != null ? s.getBranch().getName() : null)
                .build();
    }
}
