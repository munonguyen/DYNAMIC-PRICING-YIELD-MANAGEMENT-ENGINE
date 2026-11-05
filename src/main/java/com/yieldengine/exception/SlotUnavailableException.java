package com.yieldengine.exception;

import org.springframework.http.HttpStatus;

public class SlotUnavailableException extends AppException {
    public SlotUnavailableException(String message) {
        super(message, HttpStatus.CONFLICT);
    }
}

