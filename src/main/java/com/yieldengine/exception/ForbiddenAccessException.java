package com.yieldengine.exception;

import org.springframework.http.HttpStatus;

public class ForbiddenAccessException extends AppException {
    public ForbiddenAccessException(String message) {
        super(message, HttpStatus.FORBIDDEN);
    }
}
