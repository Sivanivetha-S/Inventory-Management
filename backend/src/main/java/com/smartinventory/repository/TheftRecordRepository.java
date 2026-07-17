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

    List<TheftRecord> findByAdminIdAndDetectionDateOrderByCreatedAtDesc(Long adminId, LocalDate date);

    List<TheftRecord> findByAdminIdAndDetectionDateBetweenOrderByDetectionDateDesc(
            Long adminId, LocalDate start, LocalDate end);

    @Query("SELECT t FROM TheftRecord t WHERE t.admin.id = :adminId AND t.product.id = :productId ORDER BY t.createdAt DESC")
    List<TheftRecord> findByAdminIdAndProductId(@Param("adminId") Long adminId, @Param("productId") Long productId);

    @Query("SELECT t FROM TheftRecord t WHERE t.admin.id = :adminId ORDER BY t.createdAt DESC")
    List<TheftRecord> findAllByAdminIdOrderByCreatedAtDesc(@Param("adminId") Long adminId);

    long countByAdminIdAndStatus(Long adminId, TheftRecord.TheftStatus status);

    @Query("SELECT COUNT(t) > 0 FROM TheftRecord t WHERE t.admin.id = :adminId " +
           "AND t.product.id = :productId AND t.detectionDate = :date")
    boolean existsByAdminIdAndProductIdAndDetectionDate(
            @Param("adminId") Long adminId,
            @Param("productId") Long productId,
            @Param("date") LocalDate date);
}
