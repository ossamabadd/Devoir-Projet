package ma.infraguard.customer;

import java.util.List;

import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
    private final JdbcClient db;

    public CustomerController(JdbcClient db) {
        this.db = db;
    }

    @GetMapping
    @McpTool(description = "List the demo customers with their numeric IDs, names and emails.")
    public List<Customer> listCustomers() {
        return db.sql("select id, name, email from customer order by name")
                .query(Customer.class).list();
    }

    @GetMapping("/{id}")
    @McpTool(description = "Find a customer by numeric ID and return the name and email.")
    public Customer getCustomer(@PathVariable long id) {
        return db.sql("select id, name, email from customer where id = ?").param(id)
                .query(Customer.class).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client introuvable"));
    }
}
