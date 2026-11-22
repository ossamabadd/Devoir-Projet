package ma.infraguard.ebankapp;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "customer-service")
public interface CustomerClient {
    record Customer(long id, String name, String email) {}

    @GetMapping("/api/customers/{id}")
    Customer get(@PathVariable("id") long id);
}
