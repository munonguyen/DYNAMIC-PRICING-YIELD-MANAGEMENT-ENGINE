package com.yieldengine.repository;

import com.yieldengine.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    Optional<Payment> findByProviderAndProviderRef(String provider, String providerRef);

    Optional<Payment> findFirstByBookingIdAndPaymentTypeAndStatusOrderByCreatedAtDesc(
            UUID bookingId, String paymentType, String status);

    List<Payment> findByBookingIdOrderByCreatedAtAsc(UUID bookingId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.bookingId = :bookingId AND p.status = 'SUCCESS'")
    long sumSuccessfulPaidByBookingId(@Param("bookingId") UUID bookingId);

    @Query("""
            SELECT COALESCE(SUM(p.amount), 0) FROM Payment p
            WHERE p.bookingId = :bookingId
              AND p.status = 'SUCCESS'
              AND p.paymentType IN ('DEPOSIT', 'FULL_SETTLEMENT')
            """)
    long sumSuccessfulEscrowByBookingId(@Param("bookingId") UUID bookingId);
}
