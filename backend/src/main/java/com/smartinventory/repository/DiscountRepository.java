package com.smartinventory.repository;

import com.smartinventory.entity.Discount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DiscountRepository extends JpaRepository<Discount, Long> {

    List<Discount> findByAdminId(Long adminId);

    List<Discount> findByAdminIdAndActiveTrue(Long adminId);

    Optional<Discount> findByIdAndAdminId(Long id, Long adminId);

    boolean existsByNameAndAdminId(String name, Long adminId);

    boolean existsByNameAndAdminIdAndIdNot(String name, Long adminId, Long id);
}
