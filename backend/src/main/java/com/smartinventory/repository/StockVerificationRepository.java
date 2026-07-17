package com.smartinventory.repository;

import com.smartinventory.entity.StockVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface StockVerificationRepository extends JpaRepository<StockVerification, Long> {

    Optional<StockVerification> findByAdminIdAndVerificationDate(Long adminId, LocalDate date);

    boolean existsByAdminIdAndVerificationDate(Long adminId, LocalDate date);
}
