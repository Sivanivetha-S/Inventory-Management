package com.smartinventory.repository;

import com.smartinventory.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BranchRepository extends JpaRepository<Branch, Long> {
    List<Branch> findAllByAdminId(Long adminId);
    Optional<Branch> findByIdAndAdminId(Long id, Long adminId);
}
