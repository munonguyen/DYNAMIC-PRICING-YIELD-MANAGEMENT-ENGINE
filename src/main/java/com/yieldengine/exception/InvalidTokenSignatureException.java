package com.yieldengine.exception;

import org.springframework.http.HttpStatus;

public class InvalidTokenSignatureException extends AppException {
    public InvalidTokenSignatureException(String message) {
        super(message, HttpStatus.BAD_REQUEST);
    }
}

