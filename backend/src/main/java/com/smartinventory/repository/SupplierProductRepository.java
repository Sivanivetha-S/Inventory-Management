package com.smartinventory.repository;

import com.smartinventory.entity.Supplier;
import com.smartinventory.entity.SupplierProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SupplierProductRepository extends JpaRepository<SupplierProduct, Long> {

    List<SupplierProduct> findAllBySupplierOrderByCreatedAtDesc(Supplier supplier);

    List<SupplierProduct> findAllBySupplierAndActiveTrue(Supplier supplier);

    /** All active products across ALL suppliers — for owner browsing */
    List<SupplierProduct> findAllByActiveTrueOrderByCreatedAtDesc();

    /** Owner searches supplier catalog by name, category, brand, barcode, or company */
    @Query("SELECT sp FROM SupplierProduct sp WHERE sp.active = true AND (" +
           "LOWER(sp.name)            LIKE LOWER(CONCAT('%',:q,'%')) OR " +
           "LOWER(sp.category)        LIKE LOWER(CONCAT('%',:q,'%')) OR " +
           "LOWER(sp.brand)           LIKE LOWER(CONCAT('%',:q,'%')) OR " +
           "LOWER(sp.barcodeNumber)   LIKE LOWER(CONCAT('%',:q,'%')) OR " +
           "LOWER(sp.supplier.companyName) LIKE LOWER(CONCAT('%',:q,'%')))")
    List<SupplierProduct> searchActive(@Param("q") String q);

    /** Products by a specific supplier — visible to owners */
    List<SupplierProduct> findAllBySupplierAndActiveTrueOrderByCreatedAtDesc(Supplier supplier);

    java.util.Optional<SupplierProduct> findByBarcodeNumber(String barcodeNumber);
}
