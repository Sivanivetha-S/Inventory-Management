package com.smartinventory.repository;

import com.smartinventory.entity.InvoiceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface InvoiceItemRepository extends JpaRepository<InvoiceItem, Long> {

    @Query("SELECT COALESCE(SUM(ii.quantity), 0) FROM InvoiceItem ii " +
           "WHERE ii.product.id = :productId " +
           "AND ii.invoice.admin.id = :adminId " +
           "AND ii.invoice.createdAt BETWEEN :start AND :end " +
           "AND ii.invoice.status = 'PAID'")
    Integer sumSoldQuantityByProductAndAdminAndDateRange(
            @Param("productId") Long productId,
            @Param("adminId") Long adminId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);
}
