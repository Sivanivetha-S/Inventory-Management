package com.smartinventory.dto.response;

import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerResponse {
    private Long id;
    private String name;
    private String email;
    private String phoneNumber;
    private String address;
    private boolean emailVerified;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
