package com.smartinventory.util;

import com.smartinventory.entity.Admin;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.AdminRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SecurityUtils {

    private final AdminRepository adminRepository;

    public Admin getCurrentAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResourceNotFoundException("No authenticated admin found");
        }
        String email = auth.getName();
        return adminRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found: " + email));
    }

    public Long getCurrentAdminId() {
        return getCurrentAdmin().getId();
    }
}
