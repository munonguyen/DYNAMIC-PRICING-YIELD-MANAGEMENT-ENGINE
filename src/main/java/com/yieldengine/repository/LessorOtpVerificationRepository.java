package com.yieldengine.repository;

import com.yieldengine.entity.LessorOtpVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LessorOtpVerificationRepository extends JpaRepository<LessorOtpVerification, UUID> {

    Optional<LessorOtpVerification> findByVerificationTokenAndConsumedAtIsNull(String verificationToken);

    long countByContactPhoneAndCreatedAtAfter(String contactPhone, Instant since);
}

