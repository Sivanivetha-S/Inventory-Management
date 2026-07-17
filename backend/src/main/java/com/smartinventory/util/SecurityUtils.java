package com.smartinventory.util;

import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Staff;
import com.smartinventory.exception.ResourceNotFoundException;
import com.smartinventory.repository.AdminRepository;
import com.smartinventory.repository.StaffRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SecurityUtils {

    private final AdminRepository adminRepository;
    private final StaffRepository staffRepository;

    public Admin getCurrentAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResourceNotFoundException("No authenticated user found");
        }
        String email = auth.getName();
        var adminOpt = adminRepository.findByEmail(email);
        if (adminOpt.isPresent()) {
            return adminOpt.get();
        }
        var staffOpt = staffRepository.findByEmail(email);
        if (staffOpt.isPresent()) {
            return staffOpt.get().getAdmin();
        }
        throw new ResourceNotFoundException("User not found: " + email);
    }

    public Long getCurrentAdminId() {
        return getCurrentAdmin().getId();
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private jakarta.servlet.http.HttpServletRequest httpServletRequest;

    public Long getCurrentBranchId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        String email = auth.getName();
        var staffOpt = staffRepository.findByEmail(email);
        if (staffOpt.isPresent()) {
            Staff st = staffOpt.get();
            return st.getBranch() != null ? st.getBranch().getId() : null;
        }
        if (httpServletRequest != null) {
            String val = httpServletRequest.getHeader("X-Branch-ID");
            if (val != null && !val.trim().isEmpty() && !val.equals("all")) {
                try {
                    return Long.parseLong(val);
                } catch (NumberFormatException ignored) {}
            }
        }
        return null;
    }
}
