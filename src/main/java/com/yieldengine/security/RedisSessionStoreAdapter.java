package com.yieldengine.security;


import com.yieldengine.record.security.SessionPrincipal;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yieldengine.utils.CryptoHashUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisSessionStoreAdapter implements SessionStorePort {

    private static final String SESSION_KEY_PREFIX = "auth:session:";
    private static final String USER_SESSIONS_PREFIX = "auth:user_sessions:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private final Map<String, SessionPrincipal> fallbackSessions = new ConcurrentHashMap<>();
    private final Map<UUID, Set<String>> fallbackUserTokens = new ConcurrentHashMap<>();

    @Override
    public String createSession(SessionPrincipal principal, Duration ttl) {
        String token = CryptoHashUtils.generateSecureUrlToken(32);

        try {
            String json = objectMapper.writeValueAsString(principal);
            String sessionKey = SESSION_KEY_PREFIX + token;
            String userSetKey = USER_SESSIONS_PREFIX + principal.userId();

            redisTemplate.opsForValue().set(sessionKey, json, ttl);
            redisTemplate.opsForSet().add(userSetKey, token);
            redisTemplate.expire(userSetKey, ttl.plusMinutes(5));
            return token;
        } catch (Exception e) {
            log.warn("Redis unavailable during session creation, using local memory fallback: {}", e.getMessage());
            fallbackSessions.put(token, principal);
            fallbackUserTokens.computeIfAbsent(principal.userId(), k -> ConcurrentHashMap.newKeySet()).add(token);
            return token;
        }
    }

    @Override
    public Optional<SessionPrincipal> findSession(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            String json = redisTemplate.opsForValue().get(SESSION_KEY_PREFIX + token);
            if (json != null) {
                SessionPrincipal principal = objectMapper.readValue(json, SessionPrincipal.class);
                if (principal.expiresAt() != null && principal.expiresAt().isBefore(Instant.now())) {
                    deleteSession(token);
                    return Optional.empty();
                }
                return Optional.of(principal);
            }
        } catch (Exception e) {
            log.debug("Redis unavailable during session lookup, checking fallback: {}", e.getMessage());
        }

        SessionPrincipal local = fallbackSessions.get(token);
        if (local != null && local.expiresAt() != null && local.expiresAt().isAfter(Instant.now())) {
            return Optional.of(local);
        }
        fallbackSessions.remove(token);
        return Optional.empty();
    }

    @Override
    public void deleteSession(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        SessionPrincipal removedLocal = fallbackSessions.remove(token);
        if (removedLocal != null) {
            Set<String> tokens = fallbackUserTokens.get(removedLocal.userId());
            if (tokens != null) {
                tokens.remove(token);
            }
        }
        try {
            String json = redisTemplate.opsForValue().get(SESSION_KEY_PREFIX + token);
            redisTemplate.delete(SESSION_KEY_PREFIX + token);
            if (json != null) {
                SessionPrincipal principal = objectMapper.readValue(json, SessionPrincipal.class);
                redisTemplate.opsForSet().remove(USER_SESSIONS_PREFIX + principal.userId(), token);
            }
        } catch (Exception e) {
            log.debug("Redis unavailable during session deletion: {}", e.getMessage());
        }
    }

    @Override
    public void revokeAllUserSessions(UUID userId) {
        Set<String> localTokens = fallbackUserTokens.remove(userId);
        if (localTokens != null) {
            localTokens.forEach(fallbackSessions::remove);
        }
        try {
            String userSetKey = USER_SESSIONS_PREFIX + userId;
            Set<String> tokens = redisTemplate.opsForSet().members(userSetKey);
            if (tokens != null && !tokens.isEmpty()) {
                for (String t : tokens) {
                    redisTemplate.delete(SESSION_KEY_PREFIX + t);
                }
            }
            redisTemplate.delete(userSetKey);
        } catch (Exception e) {
            log.warn("Redis unavailable while revoking sessions for user {}: {}", userId, e.getMessage());
        }
    }
}
