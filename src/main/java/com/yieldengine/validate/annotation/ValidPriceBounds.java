package com.yieldengine.validate.annotation;

import com.yieldengine.validate.PriceBoundsConstraintValidator;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = PriceBoundsConstraintValidator.class)
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidPriceBounds {
    String message() default "Invalid resource group bounds: minPrice <= basePrice <= maxPrice, slotMinutes in {30,60,90,120}, holdTtlSeconds in [60,3600]";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

