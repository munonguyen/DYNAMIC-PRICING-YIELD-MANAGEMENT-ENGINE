package com.yieldengine.validate;

import com.yieldengine.dto.request.CreateTimeSlotRequest;
import com.yieldengine.validate.annotation.ValidSlotWindow;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.math.BigDecimal;

public class SlotWindowConstraintValidator implements ConstraintValidator<ValidSlotWindow, CreateTimeSlotRequest> {

    private static final BigDecimal MIN_MULT = BigDecimal.valueOf(0.3000);
    private static final BigDecimal MAX_MULT = BigDecimal.valueOf(3.0000);

    @Override
    public boolean isValid(CreateTimeSlotRequest req, ConstraintValidatorContext context) {
        if (req == null) {
            return true;
        }
        if (req.getSlotStart() != null && req.getSlotEnd() != null && !req.getSlotEnd().isAfter(req.getSlotStart())) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate("slotEnd must be strictly after slotStart")
                    .addConstraintViolation();
            return false;
        }
        if (req.getContextMultiplier() != null
                && (req.getContextMultiplier().compareTo(MIN_MULT) < 0 || req.getContextMultiplier().compareTo(MAX_MULT) > 0)) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate("contextMultiplier must be between 0.3000 and 3.0000")
                    .addConstraintViolation();
            return false;
        }
        return true;
    }
}

