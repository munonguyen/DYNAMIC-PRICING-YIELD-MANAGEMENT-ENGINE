package com.yieldengine.validate.annotation;

import com.yieldengine.validate.SlotWindowConstraintValidator;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = SlotWindowConstraintValidator.class)
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidSlotWindow {
    String message() default "Invalid slot window: slotEnd must be after slotStart and contextMultiplier within [0.3, 3.0]";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

