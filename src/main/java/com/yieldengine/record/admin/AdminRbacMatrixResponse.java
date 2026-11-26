package com.yieldengine.record.admin;

import java.util.List;

public record AdminRbacMatrixResponse(
        List<AdminPermissionDto> permissions,
        List<AdminRoleSummaryDto> roles
) {
}

