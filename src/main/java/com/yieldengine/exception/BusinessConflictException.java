package com.yieldengine.exception;

import org.springframework.http.HttpStatus;

public class BusinessConflictException extends AppException {
    public BusinessConflictException(String message) {
        super(message, HttpStatus.CONFLICT);
    }
}
