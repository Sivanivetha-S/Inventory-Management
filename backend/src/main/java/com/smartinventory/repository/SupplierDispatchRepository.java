package com.smartinventory.repository;

import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Branch;
import com.smartinventory.entity.Supplier;
import com.smartinventory.entity.SupplierDispatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SupplierDispatchRepository extends JpaRepository<SupplierDispatch, Long> {
    List<SupplierDispatch> findAllBySupplierOrderByDispatchDateDesc(Supplier supplier);

    @Query("SELECT d FROM SupplierDispatch d WHERE d.admin = :admin AND d.branch = :branch ORDER BY d.dispatchDate DESC")
    List<SupplierDispatch> findAllByAdminAndBranchOrderByDispatchDateDesc(@Param("admin") Admin admin, @Param("branch") Branch branch);
}
