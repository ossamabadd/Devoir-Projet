package ma.infraguard.ebankapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties = {
        "spring.config.name=account-test", "spring.cloud.config.enabled=false", "spring.cloud.discovery.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:account-test", "spring.ai.mcp.server.enabled=false"
})
class EbankAppApplicationTests {
    @Autowired AccountController accounts;
    @MockitoBean CustomerClient customers;

    @Test
    void openedAccountRetainsItsBalanceAndResolvesItsOwner() {
        var owner = new CustomerClient.Customer(1, "Salma Idrissi", "salma.idrissi@example.com");
        when(customers.get(1)).thenReturn(owner);
        var opened = accounts.create(new AccountController.NewAccount(1L, Account.Type.SAVINGS, new BigDecimal("19.37")));
        assertThat(accounts.getAccount(opened.id())).isEqualTo(new AccountController.Details(opened, owner));
        assertThat(accounts.listAccounts()).contains(opened);
    }
}
