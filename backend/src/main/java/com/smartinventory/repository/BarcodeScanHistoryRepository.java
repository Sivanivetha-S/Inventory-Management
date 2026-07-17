package com.smartinventory.repository;

import com.smartinventory.entity.BarcodeScanHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BarcodeScanHistoryRepository extends JpaRepository<BarcodeScanHistory, Long> {
    List<BarcodeScanHistory> findAllByBranchIdOrderByDateTimeDesc(Long branchId);
    List<BarcodeScanHistory> findByAdminIdAndBranchIdOrderByDateTimeDesc(Long adminId, Long branchId);
    List<BarcodeScanHistory> findAllByUserEmailInOrderByDateTimeDesc(List<String> emails);
}
