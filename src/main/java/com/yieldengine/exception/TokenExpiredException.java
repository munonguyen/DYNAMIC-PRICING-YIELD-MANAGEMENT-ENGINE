package com.yieldengine.exception;

import org.springframework.http.HttpStatus;

public class TokenExpiredException extends AppException {
    public TokenExpiredException(String message) {
        super(message, HttpStatus.GONE);
    }
}
