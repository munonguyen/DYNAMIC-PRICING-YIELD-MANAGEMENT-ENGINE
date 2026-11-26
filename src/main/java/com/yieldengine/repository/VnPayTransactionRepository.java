package com.yieldengine.repository;

import com.yieldengine.entity.VnPayTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VnPayTransactionRepository extends JpaRepository<VnPayTransaction, UUID> {

    Optional<VnPayTransaction> findByTxnRef(String txnRef);

    List<VnPayTransaction> findByReservationIdOrderByCreatedAtDesc(UUID reservationId);
}

