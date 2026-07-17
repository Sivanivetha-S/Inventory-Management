package com.smartinventory.dto.response;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    @Builder.Default
    private String tokenType = "Bearer";

    /** Role of the authenticated user: ADMIN | STAFF | SUPPLIER */
    private String role;

    /** Populated when role = ADMIN */
    private AdminResponse admin;

    /** Populated when role = STAFF */
    private StaffResponse staff;

    /** Populated when role = SUPPLIER */
    private SupplierResponse supplier;
}
