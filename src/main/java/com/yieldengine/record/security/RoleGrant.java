package com.yieldengine.record.security;

import java.util.UUID;
public record RoleGrant(String roleCode, String scope, UUID tenantId) {
}
