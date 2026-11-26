package com.yieldengine.security;

import java.util.Optional;

public final class AuthContext {

    private static final ThreadLocal<SessionPrincipal> CURRENT = new ThreadLocal<>();
    private static final ThreadLocal<String> CURRENT_TOKEN = new ThreadLocal<>();

    private AuthContext() {
    }

    public static void set(SessionPrincipal principal, String rawToken) {
        CURRENT.set(principal);
        CURRENT_TOKEN.set(rawToken);
    }

    public static Optional<SessionPrincipal> current() {
        return Optional.ofNullable(CURRENT.get());
    }

    public static Optional<String> currentToken() {
        return Optional.ofNullable(CURRENT_TOKEN.get());
    }

    public static void clear() {
        CURRENT.remove();
        CURRENT_TOKEN.remove();
    }
}

