package com.smartinventory.security;

import com.smartinventory.repository.AdminRepository;
import com.smartinventory.repository.StaffRepository;
import com.smartinventory.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Multi-role UserDetailsService.
 * Lookup order: Admin → Staff → Supplier
 * All three entities implement UserDetails so the JWT filter works for every role.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminDetailsService implements UserDetailsService {

    private final AdminRepository  adminRepository;
    private final StaffRepository  staffRepository;
    private final SupplierRepository supplierRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {

        // 1. Try Admin (owner)
        var admin = adminRepository.findByEmail(email);
        if (admin.isPresent()) return admin.get();

        // 2. Try Staff
        var staff = staffRepository.findByEmail(email);
        if (staff.isPresent()) return staff.get();

        // 3. Try Supplier
        var supplier = supplierRepository.findByEmail(email);
        if (supplier.isPresent()) return supplier.get();

        log.warn("No user found with email: {}", email);
        throw new UsernameNotFoundException("User not found with email: " + email);
    }

    public UserDetails loadUserByUsernameAndRole(String email, String role) throws UsernameNotFoundException {
        if ("SUPPLIER".equalsIgnoreCase(role)) {
            var supplier = supplierRepository.findByEmail(email);
            if (supplier.isPresent()) return supplier.get();
        } else if ("STAFF".equalsIgnoreCase(role)) {
            var staff = staffRepository.findByEmail(email);
            if (staff.isPresent()) return staff.get();
        } else if ("ADMIN".equalsIgnoreCase(role)) {
            var admin = adminRepository.findByEmail(email);
            if (admin.isPresent()) return admin.get();
        }
        return loadUserByUsername(email);
    }
}
