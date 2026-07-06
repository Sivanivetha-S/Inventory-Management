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

    List<DamageRecord> findByAdminIdOrderByCreatedAtDesc(Long adminId);

    List<DamageRecord> findByAdminIdAndDamageDateOrderByCreatedAtDesc(Long adminId, LocalDate date);

    List<DamageRecord> findByAdminIdAndDamageDateBetweenOrderByDamageDateDesc(
            Long adminId, LocalDate from, LocalDate to);

    @Query("SELECT COALESCE(SUM(d.quantity), 0) FROM DamageRecord d " +
           "WHERE d.admin.id = :adminId AND d.product.id = :productId " +
           "AND d.damageDate = :date")
    Integer sumDamageByProductAndDate(
            @Param("adminId") Long adminId,
            @Param("productId") Long productId,
            @Param("date") LocalDate date);

    List<DamageRecord> findByAdminIdAndProductIdOrderByCreatedAtDesc(Long adminId, Long productId);
}
