package ma.infraguard.chatbot;

import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ChatController {
    private final BankAssistant assistant;

    public ChatController(BankAssistant assistant) {
        this.assistant = assistant;
    }

    public record Question(@NotNull UUID conversationId, @NotBlank @Size(max = 4000) String message) {}
    public record Answer(String answer) {}

    @PostMapping("/api/chat")
    public Answer ask(@RequestBody @Valid Question question) {
        return new Answer(assistant.reply("web-" + question.conversationId(), question.message().strip()));
    }
}
