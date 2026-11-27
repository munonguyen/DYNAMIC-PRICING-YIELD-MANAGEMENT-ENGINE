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

    Optional<Payment> findFirstByBookingIdAndGatewayVerifiedAtIsNotNullAndPaymentTypeNotAndStatusOrderByGatewayVerifiedAtDesc(
            UUID bookingId, String excludedPaymentType, String status);

    Optional<Payment> findFirstByBookingIdOrderByCreatedAtDescIdDesc(UUID bookingId);

    @Query("""
            SELECT p FROM Payment p
            WHERE p.booking.id = :bookingId AND p.status = 'PENDING' AND p.paymentType = 'BALANCE'
              AND p.provider = 'VIETQR_NAPAS' AND p.checkoutQrExpiresAt IS NOT NULL
            """)
    Optional<Payment> findPendingVietQrBalance(@Param("bookingId") UUID bookingId);

    boolean existsByBookingIdAndProviderInAndStatus(UUID bookingId, List<String> providers, String status);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.booking.id = :bookingId AND p.status = 'SUCCESS' AND p.paymentType <> 'REFUND' AND (p.gatewayVerifiedAt IS NOT NULL OR p.paymentType = 'BALANCE')")
    long sumSuccessfulPaidByBookingId(@Param("bookingId") UUID bookingId);

    @Query("""
            SELECT COALESCE(SUM(p.amount), 0) FROM Payment p
            WHERE p.booking.id = :bookingId AND p.status = 'SUCCESS' AND p.paymentType = 'BALANCE'
              AND p.gatewayVerifiedAt IS NOT NULL AND p.checkoutQrExpiresAt IS NOT NULL
            """)
    long sumVerifiedCheckoutBalances(@Param("bookingId") UUID bookingId);

    @Query("""
            SELECT COALESCE(SUM(p.amount), 0) FROM Payment p
            WHERE p.booking.id = :bookingId
              AND p.status = 'SUCCESS'
              AND p.paymentType IN ('DEPOSIT', 'FULL_SETTLEMENT', 'BALANCE')
              AND p.gatewayVerifiedAt IS NOT NULL
            """)
    long sumSuccessfulEscrowByBookingId(@Param("bookingId") UUID bookingId);
}
