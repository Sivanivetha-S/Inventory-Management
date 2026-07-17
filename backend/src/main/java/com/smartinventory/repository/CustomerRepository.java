package com.smartinventory.repository;

import com.smartinventory.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findByAdminId(Long adminId);

    @Query("SELECT c FROM Customer c JOIN c.branches b WHERE c.admin.id = :adminId AND b.id = :branchId")
    List<Customer> findByAdminIdAndBranchId(@Param("adminId") Long adminId, @Param("branchId") Long branchId);

    Optional<Customer> findByIdAndAdminId(Long id, Long adminId);

    @Query("SELECT c FROM Customer c JOIN c.branches b WHERE c.id = :id AND c.admin.id = :adminId AND b.id = :branchId")
    Optional<Customer> findByIdAndAdminIdAndBranchId(@Param("id") Long id, @Param("adminId") Long adminId, @Param("branchId") Long branchId);

    // email unique per admin
    Optional<Customer> findByEmailAndAdminId(String email, Long adminId);

    @Query("SELECT c FROM Customer c JOIN c.branches b WHERE c.email = :email AND c.admin.id = :adminId AND b.id = :branchId")
    Optional<Customer> findByEmailAndAdminIdAndBranchId(@Param("email") String email, @Param("adminId") Long adminId, @Param("branchId") Long branchId);

    boolean existsByEmailAndAdminId(String email, Long adminId);

    @Query("SELECT c FROM Customer c WHERE c.admin.id = :adminId AND " +
           "(LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "c.phoneNumber LIKE CONCAT('%', :search, '%'))")
    List<Customer> searchByAdminId(@Param("adminId") Long adminId, @Param("search") String search);

    @Query("SELECT c FROM Customer c JOIN c.branches b WHERE c.admin.id = :adminId AND b.id = :branchId AND " +
           "(LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "c.phoneNumber LIKE CONCAT('%', :search, '%'))")
    List<Customer> searchByAdminIdAndBranchId(@Param("adminId") Long adminId, @Param("branchId") Long branchId, @Param("search") String search);

    // For OTP verification — find pending (not yet verified) customer by email under admin
    Optional<Customer> findByEmailAndAdminIdAndEmailVerifiedFalse(String email, Long adminId);
}
