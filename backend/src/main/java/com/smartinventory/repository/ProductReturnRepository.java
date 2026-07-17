package com.smartinventory.repository;

import com.smartinventory.entity.ProductReturn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductReturnRepository extends JpaRepository<ProductReturn, Long> {

    @Query("SELECT r FROM ProductReturn r WHERE r.adminId = :adminId AND r.branchId = :branchId ORDER BY r.createdAt DESC")
    List<ProductReturn> findByAdminIdAndBranchIdOrderByCreatedAtDesc(@Param("adminId") Long adminId, @Param("branchId") Long branchId);

    @Query("SELECT COALESCE(SUM(r.quantity), 0) FROM ProductReturn r WHERE r.adminId = :adminId AND r.branchId = :branchId AND r.invoiceNumber = :invoiceNumber AND r.barcode = :barcode AND r.returnType = 'CUSTOMER_TO_OWNER'")
    Integer sumCustomerReturnedQuantity(@Param("adminId") Long adminId, @Param("branchId") Long branchId,
                                        @Param("invoiceNumber") String invoiceNumber, @Param("barcode") String barcode);

    @Query("SELECT r FROM ProductReturn r WHERE r.supplierId = :supplierId ORDER BY r.createdAt DESC")
    List<ProductReturn> findBySupplierIdOrderByCreatedAtDesc(@Param("supplierId") Long supplierId);

    @Query("SELECT r FROM ProductReturn r WHERE r.adminId = :adminId AND r.supplierId = :supplierId AND r.branchId = :branchId ORDER BY r.createdAt DESC")
    List<ProductReturn> findByAdminIdAndSupplierIdAndBranchIdOrderByCreatedAtDesc(@Param("adminId") Long adminId, @Param("supplierId") Long supplierId, @Param("branchId") Long branchId);
}
