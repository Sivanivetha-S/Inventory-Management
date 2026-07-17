package com.smartinventory.repository;

import com.smartinventory.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    Optional<Supplier> findByEmail(String email);
    boolean            existsByEmail(String email);
    List<Supplier>     findAllByActive(boolean active);
}
