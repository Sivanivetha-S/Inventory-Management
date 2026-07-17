package com.smartinventory.repository;

import com.smartinventory.entity.DamageInventory;
import com.smartinventory.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface DamageInventoryRepository extends JpaRepository<DamageInventory, Long> {
    Optional<DamageInventory> findByAdminIdAndBranchIdAndProduct(Long adminId, Long branchId, Product product);
    List<DamageInventory> findByAdminIdAndBranchId(Long adminId, Long branchId);
}
