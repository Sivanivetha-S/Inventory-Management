package com.smartinventory.repository;

import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByAdminId(Long adminId);

    @Query("SELECT p FROM Product p WHERE p.admin.id = :adminId AND p.branch.id = :branchId")
    List<Product> findByAdminIdAndBranchId(@Param("adminId") Long adminId, @Param("branchId") Long branchId);

    List<Product> findBySupplierId(Long supplierId);

    List<Product> findBySupplierIsNotNull();

    Optional<Product> findByIdAndAdminId(Long id, Long adminId);

    @Query("SELECT p FROM Product p WHERE p.id = :id AND p.admin.id = :adminId AND p.branch.id = :branchId")
    Optional<Product> findByIdAndAdminIdAndBranchId(@Param("id") Long id, @Param("adminId") Long adminId, @Param("branchId") Long branchId);

    Optional<Product> findByIdAndSupplierId(Long id, Long supplierId);

    List<Product> findByAdminIdAndCategory(Long adminId, String category);

    @Query("SELECT p FROM Product p WHERE p.admin.id = :adminId AND p.branch.id = :branchId AND p.category = :category")
    List<Product> findByAdminIdAndBranchIdAndCategory(@Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("category") String category);

    /** Find owner product by name (case-insensitive) — used when receiving dispatched stock */
    @Query("SELECT p FROM Product p WHERE p.admin.id = :adminId AND p.branch.id = :branchId AND LOWER(p.name) = LOWER(:name)")
    java.util.Optional<Product> findByAdminIdAndBranchIdAndNameIgnoreCase(
            @Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("name") String name);

    /** Barcode lookup — used when staff scans manufacturer barcode */
    @Query("SELECT p FROM Product p WHERE p.barcode = :barcode AND p.admin = :admin AND p.branch.id = :branchId")
    Optional<Product> findByBarcodeAndAdminAndBranchId(@Param("barcode") String barcode, @Param("admin") Admin admin, @Param("branchId") Long branchId);

    @Query("SELECT p FROM Product p WHERE p.admin.id = :adminId AND p.branch.id = :branchId AND p.currentStock <= p.minimumStockAlert")
    List<Product> findLowStockByAdminIdAndBranchId(@Param("adminId") Long adminId, @Param("branchId") Long branchId);

    @Query("SELECT p FROM Product p WHERE p.admin.id = :adminId AND p.branch.id = :branchId AND LOWER(p.status) != 'expired' AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.category) LIKE LOWER(CONCAT('%', :search, '%')))")
    List<Product> searchByAdminIdAndBranchId(@Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("search") String search);

    @Query("SELECT DISTINCT p.category FROM Product p WHERE p.admin.id = :adminId AND p.branch.id = :branchId ORDER BY p.category")
    List<String> findDistinctCategoriesByAdminIdAndBranchId(@Param("adminId") Long adminId, @Param("branchId") Long branchId);

    @Query("SELECT COUNT(p) FROM Product p WHERE p.admin.id = :adminId AND p.branch.id = :branchId AND p.currentStock <= p.minimumStockAlert")
    long countLowStockByAdminIdAndBranchId(@Param("adminId") Long adminId, @Param("branchId") Long branchId);
}
