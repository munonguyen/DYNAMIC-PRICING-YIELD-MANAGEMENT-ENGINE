package com.yieldengine.exception;

import org.springframework.http.HttpStatus;

public class MoMoSessionRejectedException extends AppException {
    public MoMoSessionRejectedException() {
        super("MoMo không chấp nhận yêu cầu tạo giao dịch.", HttpStatus.CONFLICT);
    }
}
