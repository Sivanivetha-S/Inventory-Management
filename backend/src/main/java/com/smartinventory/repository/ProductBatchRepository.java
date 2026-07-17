package com.smartinventory.repository;

import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Branch;
import com.smartinventory.entity.Product;
import com.smartinventory.entity.ProductBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductBatchRepository extends JpaRepository<ProductBatch, Long> {

    @Query("SELECT b FROM ProductBatch b WHERE b.product = :product AND b.admin = :admin AND b.branch = :branch ORDER BY b.expiryDate ASC, b.createdAt ASC")
    List<ProductBatch> findAllByProductAndAdminAndBranchOrderByExpiryDateAscCreatedAtAsc(
            @Param("product") Product product, @Param("admin") Admin admin, @Param("branch") Branch branch);

    @Query("SELECT b FROM ProductBatch b WHERE b.admin = :admin AND b.branch = :branch ORDER BY b.createdAt DESC")
    List<ProductBatch> findAllByAdminAndBranchOrderByCreatedAtDesc(@Param("admin") Admin admin, @Param("branch") Branch branch);

    List<ProductBatch> findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(Long adminId, Long branchId);

    @Query("SELECT b FROM ProductBatch b WHERE b.product = :product AND b.admin = :admin AND b.branch = :branch")
    List<ProductBatch> findAllByProductAndAdminAndBranch(@Param("product") Product product, @Param("admin") Admin admin, @Param("branch") Branch branch);

    /** FIFO: earliest expiry with remaining stock > 0 */
    @Query("SELECT b FROM ProductBatch b WHERE b.product = :product " +
           "AND b.admin = :admin AND b.branch = :branch AND b.quantityRemaining > 0 AND b.active = true " +
           "ORDER BY b.expiryDate ASC NULLS LAST, b.createdAt ASC")
    Optional<ProductBatch> findFirstAvailableBatch(@Param("product") Product product, @Param("admin") Admin admin, @Param("branch") Branch branch);

    /** Lookup by barcode for this admin and branch */
    @Query("SELECT b FROM ProductBatch b WHERE b.barcode = :barcode AND b.admin = :admin AND b.branch = :branch")
    List<ProductBatch> findAllByBarcodeAndAdminAndBranch(@Param("barcode") String barcode, @Param("admin") Admin admin, @Param("branch") Branch branch);
}
