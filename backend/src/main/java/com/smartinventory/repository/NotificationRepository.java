package com.smartinventory.repository;

import com.smartinventory.document.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends MongoRepository<Notification, String> {

    List<Notification> findAllByAdminIdOrderByCreatedAtDesc(Long adminId);

    Page<Notification> findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(Long adminId, Long branchId, Pageable pageable);

    Page<Notification> findAllByAdminIdOrderByCreatedAtDesc(Long adminId, Pageable pageable);

    List<Notification> findAllByAdminIdAndReadFalseOrderByCreatedAtDesc(Long adminId);

    List<Notification> findAllByAdminIdAndBranchIdAndReadFalseOrderByCreatedAtDesc(Long adminId, Long branchId);

    java.util.Optional<Notification> findByIdAndAdminIdAndBranchId(String id, Long adminId, Long branchId);

    long countByAdminIdAndReadFalse(Long adminId);

    List<Notification> findAllByAdminIdAndTypeOrderByCreatedAtDesc(Long adminId, String type);
}
