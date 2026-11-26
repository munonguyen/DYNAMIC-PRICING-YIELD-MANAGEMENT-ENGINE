package com.yieldengine.exception;

import org.springframework.http.HttpStatus;

public class IdempotencyConflictException extends AppException {
    public IdempotencyConflictException(String message) {
        super(message, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
