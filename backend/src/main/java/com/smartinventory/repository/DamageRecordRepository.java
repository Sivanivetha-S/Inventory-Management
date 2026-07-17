package com.smartinventory.repository;

import com.smartinventory.entity.DamageRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface DamageRecordRepository extends JpaRepository<DamageRecord, Long> {

    @Query("SELECT d FROM DamageRecord d WHERE d.admin.id = :adminId AND d.branch.id = :branchId ORDER BY d.createdAt DESC")
    List<DamageRecord> findByAdminIdAndBranchIdOrderByCreatedAtDesc(@Param("adminId") Long adminId, @Param("branchId") Long branchId);

    @Query("SELECT d FROM DamageRecord d WHERE d.admin.id = :adminId AND d.branch.id = :branchId AND d.damageDate = :date ORDER BY d.createdAt DESC")
    List<DamageRecord> findByAdminIdAndBranchIdAndDamageDateOrderByCreatedAtDesc(@Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("date") LocalDate date);

    @Query("SELECT d FROM DamageRecord d WHERE d.admin.id = :adminId AND d.branch.id = :branchId AND d.damageDate BETWEEN :from AND :to ORDER BY d.damageDate DESC")
    List<DamageRecord> findByAdminIdAndBranchIdAndDamageDateBetweenOrderByDamageDateDesc(
            @Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT COALESCE(SUM(d.quantity), 0) FROM DamageRecord d " +
           "WHERE d.admin.id = :adminId AND d.branch.id = :branchId AND d.product.id = :productId " +
           "AND d.damageDate = :date")
    Integer sumDamageByProductAndBranchAndDate(
            @Param("adminId") Long adminId,
            @Param("branchId") Long branchId,
            @Param("productId") Long productId,
            @Param("date") LocalDate date);

    @Query("SELECT d FROM DamageRecord d WHERE d.admin.id = :adminId AND d.branch.id = :branchId AND d.product.id = :productId ORDER BY d.createdAt DESC")
    List<DamageRecord> findByAdminIdAndBranchIdAndProductIdOrderByCreatedAtDesc(@Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("productId") Long productId);
}
