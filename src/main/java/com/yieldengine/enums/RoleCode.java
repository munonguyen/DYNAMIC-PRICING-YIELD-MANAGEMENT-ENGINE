package com.yieldengine.enums;

public enum RoleCode {
    ADMIN("PLATFORM"),
    ACCOUNTANT("PLATFORM"),
    MANAGER("TENANT"),
    STAFF("TENANT"),
    USER("PLATFORM");

    private final String scope;

    RoleCode(String scope) {
        this.scope = scope;
    }

    public String getScope() {
        return scope;
    }
}

