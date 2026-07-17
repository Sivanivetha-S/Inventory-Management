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

    @Query("SELECT i FROM Invoice i WHERE i.invoiceNumber = :invoiceNumber AND i.admin.id = :adminId AND i.branch.id = :branchId")
    Optional<Invoice> findByInvoiceNumberAndAdminIdAndBranchId(
            @Param("invoiceNumber") String invoiceNumber,
            @Param("adminId") Long adminId,
            @Param("branchId") Long branchId);

    @Query("SELECT i FROM Invoice i WHERE i.admin.id = :adminId AND i.branch.id = :branchId AND i.customer.id = :customerId")
    List<Invoice> findByAdminIdAndBranchIdAndCustomerId(
            @Param("adminId") Long adminId,
            @Param("branchId") Long branchId,
            @Param("customerId") Long customerId);

    @Query("SELECT i FROM Invoice i WHERE i.admin.id = :adminId AND " +
           "i.branch.id = :branchId AND " +
           "i.createdAt BETWEEN :start AND :end ORDER BY i.createdAt DESC")
    List<Invoice> findByAdminIdAndBranchIdAndDateRange(
            @Param("adminId") Long adminId,
            @Param("branchId") Long branchId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT i FROM Invoice i WHERE i.admin.id = :adminId AND i.branch.id = :branchId ORDER BY i.createdAt DESC")
    List<Invoice> findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(
            @Param("adminId") Long adminId,
            @Param("branchId") Long branchId);

    @Query("SELECT COALESCE(SUM(i.totalAmount), 0) FROM Invoice i " +
           "WHERE i.admin.id = :adminId AND i.branch.id = :branchId AND i.createdAt BETWEEN :start AND :end AND i.status = 'PAID'")
    BigDecimal sumRevenueByAdminIdAndBranchIdAndDateRange(
            @Param("adminId") Long adminId,
            @Param("branchId") Long branchId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(i.totalAmount), 0) FROM Invoice i " +
           "WHERE i.admin.id = :adminId AND i.branch.id = :branchId AND i.status = 'PAID'")
    BigDecimal sumTotalRevenueByAdminIdAndBranchId(
            @Param("adminId") Long adminId,
            @Param("branchId") Long branchId);

    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.admin.id = :adminId AND i.branch.id = :branchId")
    long countByAdminIdAndBranchId(
            @Param("adminId") Long adminId,
            @Param("branchId") Long branchId);

    @Query("SELECT i FROM Invoice i WHERE i.admin.id = :adminId AND i.branch.id = :branchId AND " +
           "(LOWER(i.invoiceNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(i.customer.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    List<Invoice> searchByAdminIdAndBranchId(
            @Param("adminId") Long adminId,
            @Param("branchId") Long branchId,
            @Param("search") String search);

    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.staff = :staff AND i.branch.id = :branchId")
    long countByStaffAndBranchId(
            @Param("staff") com.smartinventory.entity.Staff staff,
            @Param("branchId") Long branchId);

    @Query("SELECT COALESCE(SUM(i.totalAmount), 0) FROM Invoice i WHERE i.staff.id = :staffId AND i.branch.id = :branchId")
    BigDecimal sumTotalRevenueByStaffIdAndBranchId(
            @Param("staffId") Long staffId,
            @Param("branchId") Long branchId);

    boolean existsByInvoiceNumber(String invoiceNumber);

    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.invoiceNumber LIKE :pattern")
    long countByInvoiceNumberLike(@Param("pattern") String pattern);
}
