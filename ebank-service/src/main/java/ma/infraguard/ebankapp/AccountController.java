package ma.infraguard.ebankapp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import feign.FeignException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {
    private final JdbcClient db;
    private final CustomerClient customers;

    public AccountController(JdbcClient db, CustomerClient customers) {
        this.db = db;
        this.customers = customers;
    }

    public record NewAccount(@NotNull @Positive Long customerId, @NotNull Account.Type type,
                             @NotNull @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal balance) {}
    public record Details(Account account, CustomerClient.Customer customer) {}

    @GetMapping
    @McpTool(description = "List all demo accounts including UUID, customer ID, type, balance in MAD and opening date.")
    public List<Account> listAccounts() {
        return db.sql("select * from bank_account order by created_at desc, id")
                .query(Account.class).list();
    }

    @GetMapping("/{id}")
    @McpTool(description = "Get an account by UUID, including its balance in MAD and its owner's name and email.")
    public Details getAccount(@PathVariable UUID id) {
        Account account = db.sql("select * from bank_account where id = ?").param(id)
                .query(Account.class).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Compte introuvable"));
        return new Details(account, customer(account.customerId()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Account create(@Valid @RequestBody NewAccount request) {
        customer(request.customerId());
        Account account = new Account(UUID.randomUUID(), request.customerId(), request.type(),
                request.balance(), LocalDate.now());
        db.sql("insert into bank_account (id, customer_id, type, balance, created_at) values (?, ?, ?, ?, ?)")
                .params(account.id(), account.customerId(), account.type().name(), account.balance(), account.createdAt())
                .update();
        return account;
    }

    private CustomerClient.Customer customer(long id) {
        try {
            return customers.get(id);
        } catch (FeignException.NotFound ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Client introuvable", ex);
        } catch (FeignException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Service clients indisponible", ex);
        }
    }
}
