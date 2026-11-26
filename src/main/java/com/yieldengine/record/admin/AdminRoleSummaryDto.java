package com.yieldengine.record.admin;

import java.util.List;

public record AdminRoleSummaryDto(
        Short id,
        String code,
        String name,
        String scope,
        long userCount,
        List<String> permissionCodes
) {
}

