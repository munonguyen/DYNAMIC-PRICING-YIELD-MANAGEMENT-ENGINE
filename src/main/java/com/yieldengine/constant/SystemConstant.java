package com.yieldengine.constant;

public final class SystemConstant {

    private SystemConstant() {
    }

    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_ACCOUNTANT = "ACCOUNTANT";
    public static final String ROLE_MANAGER = "MANAGER";
    public static final String ROLE_STAFF = "STAFF";
    public static final String ROLE_USER = "USER";

    public static final String USER_ROLE = "ROLE_USER";
    public static final String MANAGER_ROLE = "ROLE_MANAGER";
    public static final String ADMIN_ROLE = "ROLE_ADMIN";

    public static final String SCOPE_PLATFORM = "PLATFORM";
    public static final String SCOPE_TENANT = "TENANT";

    public static final String HEADER_IDEMPOTENCY_KEY = "Idempotency-Key";
    public static final String HEADER_AUTHORIZATION = "Authorization";
}
