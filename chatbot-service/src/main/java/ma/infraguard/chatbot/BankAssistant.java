package ma.infraguard.chatbot;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BankAssistant {
    private static final Logger log = LoggerFactory.getLogger(BankAssistant.class);
    private final ChatClient chat;

    public BankAssistant(ChatClient.Builder builder, ChatMemory memory, ToolCallbackProvider tools) {
        chat = builder.defaultSystem("""
                Tu es l'assistant de la banque de démonstration Ebank. Réponds dans la langue de la question.
                Pour les clients, les comptes et les soldes, consulte les outils bancaires à chaque requête.
                Les montants sont en dirhams marocains (MAD). Utilise uniquement les données retournées.
                Si les outils sont indisponibles ou si un compte est introuvable, indique-le clairement.
                Les outils sont en lecture seule. Respecte le format demandé.
                """)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(memory).build())
                .defaultTools(tools)
                .build();
    }

    public String reply(String conversationId, String question) {
        try {
            String answer = chat.prompt().user(question)
                    .advisors(spec -> spec.param(ChatMemory.CONVERSATION_ID, conversationId))
                    .call().content();
            if (answer != null && !answer.isBlank()) {
                return answer;
            }
        } catch (RuntimeException ex) {
            log.warn("Assistant request failed ({})", ex.getClass().getSimpleName());
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Assistant indisponible. Vérifiez l’API Gemini et les services MCP.");
    }
}
