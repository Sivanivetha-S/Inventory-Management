package com.smartinventory.repository;

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

    Optional<Product> findByIdAndAdminId(Long id, Long adminId);

    List<Product> findByAdminIdAndCategory(Long adminId, String category);

    @Query("SELECT p FROM Product p WHERE p.admin.id = :adminId AND p.currentStock <= p.minimumStockAlert")
    List<Product> findLowStockByAdminId(@Param("adminId") Long adminId);

    @Query("SELECT p FROM Product p WHERE p.admin.id = :adminId AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.category) LIKE LOWER(CONCAT('%', :search, '%')))")
    List<Product> searchByAdminId(@Param("adminId") Long adminId, @Param("search") String search);

    @Query("SELECT DISTINCT p.category FROM Product p WHERE p.admin.id = :adminId ORDER BY p.category")
    List<String> findDistinctCategoriesByAdminId(@Param("adminId") Long adminId);

    @Query("SELECT COUNT(p) FROM Product p WHERE p.admin.id = :adminId AND p.currentStock <= p.minimumStockAlert")
    long countLowStockByAdminId(@Param("adminId") Long adminId);
}
