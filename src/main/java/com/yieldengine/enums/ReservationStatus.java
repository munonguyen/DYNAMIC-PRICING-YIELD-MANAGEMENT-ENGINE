package com.yieldengine.enums;

import java.util.EnumSet;
import java.util.Set;

/**
 * Rich State Pattern enforcing valid Reservation lifecycle transitions (SRS III.3).
 */
public enum ReservationStatus {
    HELD,
    CONFIRMED,
    EXPIRED,
    CANCELLED,
    COMPLETED,
    NO_SHOW;

    public Set<ReservationStatus> allowedTransitions() {
        return switch (this) {
            case HELD -> EnumSet.of(CONFIRMED, EXPIRED, CANCELLED);
            case EXPIRED -> EnumSet.of(CONFIRMED, CANCELLED); // Late payment re-grant if court still free
            case CONFIRMED -> EnumSet.of(CANCELLED, COMPLETED, NO_SHOW);
            case CANCELLED, COMPLETED, NO_SHOW -> EnumSet.noneOf(ReservationStatus.class);
        };
    }

    public boolean canTransitionTo(ReservationStatus target) {
        return allowedTransitions().contains(target);
    }

    public void assertCanTransitionTo(ReservationStatus target) {
        if (!canTransitionTo(target)) {
            throw new IllegalStateException(
                    String.format("Invalid reservation state transition: %s -> %s", this.name(), target.name())
            );
        }
    }
}
