package com.smartinventory.repository;

import com.smartinventory.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findByInvoiceNumberAndAdminId(String invoiceNumber, Long adminId);

    List<Invoice> findByAdminIdAndCustomerId(Long adminId, Long customerId);

    @Query("SELECT i FROM Invoice i WHERE i.admin.id = :adminId AND " +
           "i.createdAt BETWEEN :start AND :end ORDER BY i.createdAt DESC")
    List<Invoice> findByAdminIdAndDateRange(
            @Param("adminId") Long adminId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT i FROM Invoice i WHERE i.admin.id = :adminId ORDER BY i.createdAt DESC")
    List<Invoice> findAllByAdminIdOrderByCreatedAtDesc(@Param("adminId") Long adminId);

    @Query("SELECT COALESCE(SUM(i.totalAmount), 0) FROM Invoice i " +
           "WHERE i.admin.id = :adminId AND i.createdAt BETWEEN :start AND :end AND i.status = 'PAID'")
    BigDecimal sumRevenueByAdminIdAndDateRange(
            @Param("adminId") Long adminId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(i.totalAmount), 0) FROM Invoice i " +
           "WHERE i.admin.id = :adminId AND i.status = 'PAID'")
    BigDecimal sumTotalRevenueByAdminId(@Param("adminId") Long adminId);

    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.admin.id = :adminId")
    long countByAdminId(@Param("adminId") Long adminId);

    @Query("SELECT i FROM Invoice i WHERE i.admin.id = :adminId AND " +
           "(LOWER(i.invoiceNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(i.customer.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    List<Invoice> searchByAdminId(@Param("adminId") Long adminId, @Param("search") String search);
}
