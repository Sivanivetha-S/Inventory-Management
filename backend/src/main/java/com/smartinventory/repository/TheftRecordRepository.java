package com.smartinventory.repository;

import com.smartinventory.entity.TheftRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TheftRecordRepository extends JpaRepository<TheftRecord, Long> {

    @Query("SELECT t FROM TheftRecord t WHERE t.admin.id = :adminId AND t.branch.id = :branchId AND t.detectionDate = :date ORDER BY t.createdAt DESC")
    List<TheftRecord> findByAdminIdAndBranchIdAndDetectionDateOrderByCreatedAtDesc(
            @Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("date") LocalDate date);

    @Query("SELECT t FROM TheftRecord t WHERE t.admin.id = :adminId AND t.branch.id = :branchId AND t.detectionDate BETWEEN :start AND :end ORDER BY t.detectionDate DESC")
    List<TheftRecord> findByAdminIdAndBranchIdAndDetectionDateBetweenOrderByDetectionDateDesc(
            @Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT t FROM TheftRecord t WHERE t.admin.id = :adminId AND t.branch.id = :branchId AND t.product.id = :productId ORDER BY t.createdAt DESC")
    List<TheftRecord> findByAdminIdAndBranchIdAndProductId(
            @Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("productId") Long productId);

    @Query("SELECT t FROM TheftRecord t WHERE t.admin.id = :adminId AND t.branch.id = :branchId ORDER BY t.createdAt DESC")
    List<TheftRecord> findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(
            @Param("adminId") Long adminId, @Param("branchId") Long branchId);

    @Query("SELECT COUNT(t) FROM TheftRecord t WHERE t.admin.id = :adminId AND t.branch.id = :branchId AND t.status = :status")
    long countByAdminIdAndBranchIdAndStatus(
            @Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("status") TheftRecord.TheftStatus status);

    @Query("SELECT COUNT(t) > 0 FROM TheftRecord t WHERE t.admin.id = :adminId AND t.branch.id = :branchId " +
           "AND t.product.id = :productId AND t.detectionDate = :date")
    boolean existsByAdminIdAndBranchIdAndProductIdAndDetectionDate(
            @Param("adminId") Long adminId,
            @Param("branchId") Long branchId,
            @Param("productId") Long productId,
            @Param("date") LocalDate date);
}
