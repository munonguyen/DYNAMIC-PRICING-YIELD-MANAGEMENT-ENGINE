package com.yieldengine.validate;

import com.yieldengine.dto.request.ResourceGroupRequest;
import com.yieldengine.validate.annotation.ValidPriceBounds;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.Set;

public class PriceBoundsConstraintValidator implements ConstraintValidator<ValidPriceBounds, ResourceGroupRequest> {

    private static final Set<Integer> ALLOWED_SLOT_MINUTES = Set.of(30, 60, 90, 120);

    @Override
    public boolean isValid(ResourceGroupRequest req, ConstraintValidatorContext context) {
        if (req == null) {
            return true;
        }
        if (req.getMinPrice() != null && req.getBasePrice() != null && req.getMaxPrice() != null) {
            if (req.getMinPrice() > req.getBasePrice() || req.getBasePrice() > req.getMaxPrice()) {
                return fail(context, "Price bounds invariant violated: minPrice <= basePrice <= maxPrice");
            }
        }
        if (req.getSlotMinutes() != null && !ALLOWED_SLOT_MINUTES.contains(req.getSlotMinutes())) {
            return fail(context, "slotMinutes must be one of 30, 60, 90, or 120");
        }
        if (req.getHoldTtlSeconds() != null && (req.getHoldTtlSeconds() < 60 || req.getHoldTtlSeconds() > 3600)) {
            return fail(context, "holdTtlSeconds must be between 60 and 3600");
        }
        return true;
    }

    private boolean fail(ConstraintValidatorContext context, String message) {
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(message).addConstraintViolation();
        return false;
    }
}

