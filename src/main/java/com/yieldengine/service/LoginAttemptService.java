package com.yieldengine.service;

import com.yieldengine.entity.User;
import com.yieldengine.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Isolated transaction service so brute-force failed counters persist even when login throws 401 (NFR-02).
 */
@Service
@RequiredArgsConstructor
public class LoginAttemptService {

    public static final short MAX_FAILED_ATTEMPTS = 5;
    public static final Duration LOCKOUT_DURATION = Duration.ofMinutes(15);

    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailedAttempt(UUID userId, Instant now) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return;
        }
        short attempts = (short) ((user.getFailedLoginAttempts() != null ? user.getFailedLoginAttempts() : 0) + 1);
        user.setFailedLoginAttempts(attempts);
        if (attempts >= MAX_FAILED_ATTEMPTS) {
            Instant lockExpiry = now.plus(LOCKOUT_DURATION);
            user.setLockedUntil(lockExpiry);
            auditLogService.record(
                    user.getId(),
                    "USER",
                    null,
                    "USER_LOGIN_LOCKED",
                    "USER",
                    user.getId().toString(),
                    Map.of("failedAttempts", attempts, "lockedUntil", lockExpiry.toString())
            );
        }
        userRepository.save(user);
    }
}

