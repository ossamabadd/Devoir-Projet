package ma.infraguard.chatbot;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Component
@ConditionalOnProperty(name = "telegram.bot-token")
public class TelegramBot {
    private static final Logger log = LoggerFactory.getLogger(TelegramBot.class);
    private final RestClient api;
    private final BankAssistant assistant;
    private long offset;

    public TelegramBot(@Value("${telegram.bot-token}") String token,
                       @Value("${telegram.api-root:https://api.telegram.org}") String apiRoot,
                       BankAssistant assistant) {
        this.api = RestClient.create(apiRoot + "/bot" + token);
        this.assistant = assistant;
    }

    record Chat(long id, String type) {}
    record Message(Chat chat, String text) {}
    record Update(@JsonProperty("update_id") long updateId, Message message) {}
    record Updates(boolean ok, List<Update> result) {}

    @Scheduled(fixedDelay = 1500)
    public void poll() {
        try {
            Updates updates = api.post().uri("/getUpdates")
                    .body(Map.of("offset", offset, "timeout", 20, "allowed_updates", List.of("message")))
                    .retrieve().body(Updates.class);
            if (updates == null || !updates.ok() || updates.result() == null) {
                return;
            }
            for (Update update : updates.result()) {
                process(update.message());
                offset = update.updateId() + 1;
            }
        } catch (RuntimeException ex) {
            log.warn("Telegram polling failed ({})", ex.getClass().getSimpleName());
        }
    }

    private void process(Message message) {
        if (message == null || message.chat() == null || !"private".equals(message.chat().type())
                || message.text() == null || message.text().isBlank()) {
            return;
        }
        long id = message.chat().id();
        String reply;
        if (message.text().equals("/start")) {
            reply = "Bienvenue sur Ebank. Posez une question sur les comptes et clients de démonstration.";
        } else {
            try {
                reply = assistant.reply("telegram-" + id, message.text());
            } catch (ResponseStatusException ex) {
                reply = "L’assistant est temporairement indisponible. Réessayez dans un instant.";
            }
        }
        for (int start = 0; start < reply.length();) {
            int end = Math.min(start + 4096, reply.length());
            if (end < reply.length() && Character.isHighSurrogate(reply.charAt(end - 1))) {
                end--;
            }
            try {
                api.post().uri("/sendMessage").body(Map.of("chat_id", id, "text", reply.substring(start, end)))
                        .retrieve().toBodilessEntity();
            } catch (RestClientResponseException ex) {
                if (ex.getStatusCode().value() == 403) {
                    return;
                }
                throw ex;
            }
            start = end;
        }
    }
}
