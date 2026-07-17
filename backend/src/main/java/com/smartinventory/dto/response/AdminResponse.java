package com.smartinventory.dto.response;

import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminResponse {
    private Long id;
    private String fullName;
    private String email;
    private String phoneNumber;
    private String shopName;
    private String shopCategory;
    private boolean emailVerified;
    private boolean registrationComplete;
    private LocalDateTime createdAt;
}
