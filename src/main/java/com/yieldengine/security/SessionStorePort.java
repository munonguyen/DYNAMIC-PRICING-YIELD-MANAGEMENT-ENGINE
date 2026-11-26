package com.yieldengine.security;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

/**
 * Hexagonal Port for ephemeral session management (FR-03, NFR-05).
 */
public interface SessionStorePort {
    String createSession(SessionPrincipal principal, Duration ttl);
    Optional<SessionPrincipal> findSession(String token);
    void deleteSession(String token);
    void revokeAllUserSessions(UUID userId);
}

