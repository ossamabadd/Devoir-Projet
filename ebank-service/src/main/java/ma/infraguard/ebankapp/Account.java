package ma.infraguard.ebankapp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record Account(UUID id, long customerId, Type type, BigDecimal balance, LocalDate createdAt) {
    public enum Type { CURRENT, SAVINGS }
}
