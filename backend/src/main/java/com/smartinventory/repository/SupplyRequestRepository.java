package com.smartinventory.repository;

import com.smartinventory.entity.Admin;
import com.smartinventory.entity.Branch;
import com.smartinventory.entity.SupplyRequest;
import com.smartinventory.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SupplyRequestRepository extends JpaRepository<SupplyRequest, Long> {

    @Query("SELECT r FROM SupplyRequest r WHERE r.admin = :admin AND r.branch = :branch ORDER BY r.createdAt DESC")
    List<SupplyRequest> findAllByAdminAndBranchOrderByCreatedAtDesc(@Param("admin") Admin admin, @Param("branch") Branch branch);

    List<SupplyRequest> findAllBySupplierOrderByCreatedAtDesc(Supplier supplier);

    @Query("SELECT r FROM SupplyRequest r WHERE r.admin = :admin AND r.branch = :branch AND r.status = :status ORDER BY r.createdAt DESC")
    List<SupplyRequest> findAllByAdminAndBranchAndStatusOrderByCreatedAtDesc(
            @Param("admin") Admin admin, @Param("branch") Branch branch, @Param("status") SupplyRequest.RequestStatus status);

    List<SupplyRequest> findAllBySupplierAndStatusOrderByCreatedAtDesc(
            Supplier supplier, SupplyRequest.RequestStatus status);
}
