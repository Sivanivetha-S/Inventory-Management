package com.smartinventory.repository;

import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Staff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StaffRepository extends JpaRepository<Staff, Long> {
    List<Staff>      findAllByAdmin(Admin admin);
    List<Staff>      findAllByAdminAndBranch(Admin admin, com.smartinventory.entity.Branch branch);
    Optional<Staff>  findByIdAndAdminAndBranch(Long id, Admin admin, com.smartinventory.entity.Branch branch);
    Optional<Staff>  findByEmail(String email);
    boolean          existsByEmail(String email);
    List<Staff>      findAllByAdminAndActive(Admin admin, boolean active);
}
