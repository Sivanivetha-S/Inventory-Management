package com.smartinventory.repository;

import com.smartinventory.entity.OtpVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public interface OtpVerificationRepository extends JpaRepository<OtpVerification, Long> {

    Optional<OtpVerification> findTopByEmailAndOtpTypeAndUsedFalseOrderByCreatedAtDesc(
            String email, OtpVerification.OtpType otpType);

    @Modifying
    @Transactional
    @Query("DELETE FROM OtpVerification o WHERE o.email = :email AND o.otpType = :otpType")
    void deleteAllByEmailAndOtpType(@Param("email") String email,
                                    @Param("otpType") OtpVerification.OtpType otpType);
}
