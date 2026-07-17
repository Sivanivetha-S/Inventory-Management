package com.smartinventory.repository;

import com.smartinventory.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findAllByOrderByDateTimeDesc();
    List<AuditLog> findByOwnerIdAndBranchIdOrderByDateTimeDesc(Long ownerId, Long branchId);
}
