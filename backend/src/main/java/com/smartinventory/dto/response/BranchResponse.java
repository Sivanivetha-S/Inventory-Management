package com.smartinventory.dto.response;

import com.smartinventory.entity.Branch;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class BranchResponse {
    private Long id;
    private String name;
    private String code;
    private String address;
    private String city;
    private String state;
    private String pincode;
    private String contactNumber;
    private boolean active;
    private String ownerEmail;
    private LocalDateTime createdAt;

    public static BranchResponse from(Branch b) {
        return BranchResponse.builder()
                .id(b.getId())
                .name(b.getName())
                .code(b.getCode())
                .address(b.getAddress())
                .city(b.getCity())
                .state(b.getState())
                .pincode(b.getPincode())
                .contactNumber(b.getContactNumber())
                .active(b.isActive())
                .ownerEmail(b.getAdmin().getEmail())
                .createdAt(b.getCreatedAt())
                .build();
    }
}
