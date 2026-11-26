package com.yieldengine.repository;

import com.yieldengine.entity.LessorApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface LessorApplicationRepository extends JpaRepository<LessorApplication, UUID> {

    boolean existsByTaxCodeAndStatusIn(String taxCode, Collection<String> statuses);

    boolean existsByCccdNumberAndStatusIn(String cccdNumber, Collection<String> statuses);

    boolean existsByCccdFrontSha256OrBusinessDocSha256OrCourtPhotoSha256(
            String cccdFrontSha256,
            String businessDocSha256,
            String courtPhotoSha256
    );

    List<LessorApplication> findAllByOrderByCreatedAtDesc();

    List<LessorApplication> findByApplicantUserIdOrderByCreatedAtDesc(UUID applicantUserId);
}

