# Ebank

Application bancaire de démonstration en français. Le portail Angular permet de rechercher des comptes, de les filtrer par type, d’ouvrir un compte pour un client et de consulter son solde en dirhams. L’assistant Spring AI accède aux mêmes données par MCP depuis le navigateur et Telegram.

## Démarrer sur sa machine

Prérequis : JDK 21 ou 25 et Node.js 24 avec npm. Depuis la racine du projet :

```powershell
.\mvnw.cmd package
npm --prefix frontend ci
npm --prefix frontend run build
```

Dans IntelliJ, démarrer `ConfigApplication`, puis `DiscoveryApplication`, `CustomerApplication`, `EbankAppApplication`, `ChatbotApplication` et `GatewayApplication`. Utiliser la racine du projet comme répertoire de travail pour chaque configuration. Chaque service peut aussi être lancé avec `java -jar` et son JAR dans le répertoire `target/`.

Ouvrir [le portail Ebank](http://127.0.0.1:8080/).

Le script optionnel `python run.py` démarre les JAR compilés et écrit leurs journaux dans `.local/logs/`. Il nécessite Python 3.9 ou supérieur ; Ctrl+C arrête les services qu’il a lancés.

Au premier démarrage, les deux bases H2 créent six clients fictifs et huit comptes. Les comptes ouverts ensuite sont conservés dans `.local/data/` entre les démarrages. Les services écoutent sur l’interface locale. Cette version est un espace de démonstration partagé avec des données fictives.

## Services

| Service | Port | Fonction |
| --- | ---: | --- |
| Config | 8888 | Distribue les propriétés communes et celles de chaque service depuis `config-service/src/main/resources/config/`. |
| Discovery | 8761 | Registre Eureka utilisé par la passerelle et OpenFeign. |
| Customer | 8081 | Gère la base clients et expose les outils MCP `listCustomers` et `getCustomer`. |
| Ebank | 8082 | Gère les comptes et expose `listAccounts` et `getAccount` par MCP. Résout le titulaire via OpenFeign lors de l’ouverture et de la consultation d’un compte. |
| Chatbot | 8093 | Orchestre l’API Gemini, les deux serveurs MCP et les conversations web et Telegram. |
| Gateway | 8080 | Sert le portail compilé et distribue les appels REST via Eureka. |

Les deux serveurs MCP utilisent le transport Streamable HTTP sur leur propre chemin `/mcp`. Seules les opérations de lecture sont accessibles au modèle. L’ouverture d’un compte passe par le formulaire ou l’API REST.

## Assistant et Telegram

L’assistant utilise l’API Gemini via Google GenAI et Spring AI. Créer une clé dans [Google AI Studio](https://aistudio.google.com/apikey), puis définir `GEMINI_API_KEY` dans les variables d’environnement de la configuration IntelliJ `ChatbotApplication`. Le modèle par défaut est `gemini-3.5-flash-lite` ; `GEMINI_MODEL` permet de choisir un autre modèle prenant en charge les appels d’outils ([modèles disponibles](https://ai.google.dev/gemini-api/docs/models)).

Pour une configuration locale sans variable d’environnement, créer `.local/chatbot-secrets.properties` :

```properties
spring.ai.google.genai.api-key=votre-cle-api
```

Ce fichier est ignoré par Git et chargé uniquement par le chatbot. La clé reste côté serveur.

Pour activer Telegram, définir `TELEGRAM_BOT_TOKEN` avec le jeton du bot avant le démarrage. Envoyer `/start` au bot en conversation privée. Le bot reçoit les messages par long polling et utilise une mémoire distincte pour chaque discussion. Les conversations web disposent également de leur propre mémoire en RAM.

Une question à essayer dans le portail ou dans Telegram est « Liste les comptes de Salma Idrissi dans un tableau avec leur solde en MAD. »

## API via la passerelle

| Méthode | Chemin | Résultat |
| --- | --- | --- |
| GET | `/api/customers` ou `/api/customers/{id}` | Annuaire ou fiche client. |
| GET | `/api/accounts` | Liste des comptes. |
| GET | `/api/accounts/{uuid}` | Compte et titulaire. |
| POST | `/api/accounts` | Ouvre un compte et retourne HTTP 201. |
| POST | `/api/chat` | Retourne la réponse dans le champ `answer`. |

Exemple de corps pour ouvrir un compte avec un solde initial positif ou nul, à deux décimales au maximum.

```json
{ "customerId": 1, "type": "SAVINGS", "balance": 1250.75 }
```

Les types disponibles sont `CURRENT` et `SAVINGS`. Pour le chat, réutiliser le même UUID par conversation.

```json
{ "conversationId": "31dd5012-d7b5-4733-8f67-01cc1c5b2bd2", "message": "Qui est le client numéro 1 ?" }
```

## Vérification et développement

- `.\mvnw.cmd verify` exécute les tests Java ; `npm --prefix frontend run build` vérifie la compilation Angular.
- Avec la pile en cours d’exécution, `python tests/chat_flow.py` lance un chatbot de test sur un port temporaire. Il exerce les vrais services MCP, la résolution OpenFeign et la mémoire de conversation. Des serveurs HTTP locaux simulent les réponses de Gemini ainsi que la réception, l’envoi et l’acquittement des messages Telegram. Le test fonctionne hors ligne après compilation, sans clé Gemini réelle.
- Pour modifier l’interface avec rechargement automatique, lancer `npm start` depuis `frontend/` pendant que la pile tourne. Ouvrir [le serveur Angular](http://127.0.0.1:4200/). Les appels `/api` sont relayés à la passerelle locale.
