package ma.infraguard.ebankapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class EbankAppApplication {
    public static void main(String[] args) {
        SpringApplication.run(EbankAppApplication.class, args);
    }
}
