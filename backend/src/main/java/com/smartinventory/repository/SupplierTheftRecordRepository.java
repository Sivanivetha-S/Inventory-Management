package com.smartinventory.repository;

import com.smartinventory.entity.Supplier;
import com.smartinventory.entity.SupplierTheftRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SupplierTheftRecordRepository extends JpaRepository<SupplierTheftRecord, Long> {
    List<SupplierTheftRecord> findAllBySupplierOrderByDateDesc(Supplier supplier);
}
