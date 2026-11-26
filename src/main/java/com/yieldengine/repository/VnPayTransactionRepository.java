package com.yieldengine.repository;

import com.yieldengine.entity.VnPayTransaction;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VnPayTransactionRepository extends JpaRepository<VnPayTransaction, UUID> {

    Optional<VnPayTransaction> findByTxnRef(String txnRef);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM VnPayTransaction t WHERE t.txnRef = :ref")
    Optional<VnPayTransaction> lockByTxnRef(@Param("ref") String txnRef);

    Optional<VnPayTransaction> findFirstByReservationIdOrderByCreatedAtDesc(UUID reservationId);

    boolean existsByReservationIdAndStatus(UUID reservationId, com.yieldengine.enums.VnPayTransactionStatus status);

    List<VnPayTransaction> findByReservationIdOrderByCreatedAtDesc(UUID reservationId);
}

