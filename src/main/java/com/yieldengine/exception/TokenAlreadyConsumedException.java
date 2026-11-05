package com.yieldengine.exception;

import org.springframework.http.HttpStatus;

public class TokenAlreadyConsumedException extends AppException {
    public TokenAlreadyConsumedException(String message) {
        super(message, HttpStatus.CONFLICT);
    }
}

