import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
ACCOUNT = "9f3df0d1-c49e-4380-922c-17c33ce98754"
WEB_QUESTION = "Quel est le solde du compte " + ACCOUNT + " ?"
FOLLOW_UP = "Rappelle-moi le compte demandé."
TELEGRAM_QUESTION = "Qui est le client numéro 1 ?"
REJECTED_QUESTION = "Simule une clé API invalide."
THOUGHT_SIGNATURE = "Zml4dHVyZS10aG91Z2h0LXNpZ25hdHVyZQ=="


def post(url, body):
    request = Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urlopen(request, timeout=35) as response:
        return json.load(response)


class Providers(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def read_json(self):
        if self.headers.get("Transfer-Encoding", "").lower() != "chunked":
            return json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        body = bytearray()
        while True:
            length = int(self.rfile.readline().split(b";", 1)[0].strip(), 16)
            if length == 0:
                self.rfile.readline()
                return json.loads(body)
            body.extend(self.rfile.read(length))
            self.rfile.read(2)

    def do_POST(self):
        try:
            payload = self.read_json()
            if self.path == "/v1beta/models/fixture:generateContent":
                assert self.headers.get("x-goog-api-key") == "fixture", "Missing Gemini API key"
                data = self.gemini(payload)
                if data is None:
                    self.send_error(401, "Gemini fixture rejected the API key")
                    return
            elif self.path == "/botfixture/getUpdates":
                updates = []
                if self.server.deliver.is_set() and payload["offset"] <= 17:
                    updates.append({"update_id": 17, "message": {
                        "chat": {"id": 101, "type": "private"}, "text": TELEGRAM_QUESTION}})
                if payload["offset"] == 18:
                    self.server.confirmed.set()
                data = {"ok": True, "result": updates}
            elif self.path == "/botfixture/sendMessage":
                self.server.sent.append(payload)
                data = {"ok": True, "result": {"message_id": 5}}
            else:
                raise AssertionError("Unexpected provider endpoint " + self.path)
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as error:
            self.server.errors.append(str(error))
            self.send_error(500)

    def gemini(self, request):
        assert not request.get("generationConfig", {}).get("thinkingConfig", {}).get("includeThoughts"), \
            "Chat responses should not request reasoning summaries"
        messages = request["contents"]
        questions = [p["text"] for m in messages if m["role"] == "user"
                     for p in m["parts"] if "text" in p]
        question = questions[-1]
        answer = {"role": "model", "parts": []}
        if question == FOLLOW_UP:
            assert WEB_QUESTION in questions, "Web follow-up lost its conversation history"
            answer["parts"] = [{"text": ACCOUNT}]
        elif question == REJECTED_QUESTION:
            return None
        elif question in (WEB_QUESTION, TELEGRAM_QUESTION):
            web = question == WEB_QUESTION
            if not web:
                assert WEB_QUESTION not in questions, "Telegram received browser conversation history"
            responses = [p["functionResponse"] for p in messages[-1]["parts"]
                         if "functionResponse" in p]
            if responses:
                calls = [p for m in messages if m["role"] == "model"
                         for p in m["parts"] if "functionCall" in p]
                assert calls[-1].get("thoughtSignature") == THOUGHT_SIGNATURE, \
                    "Gemini tool call lost its thought signature"
                assert responses[-1]["name"] == calls[-1]["functionCall"]["name"], \
                    "Gemini tool response does not match its function call"
                result = json.dumps(responses[-1]["response"], ensure_ascii=False)
                assert "Salma Idrissi" in result, "Missing customer in tool response: " + result
                if web:
                    assert ACCOUNT in result and "45200" in result, "Incorrect account result: " + result
                answer["parts"] = [{"text": "45 200 MAD, Salma Idrissi." if web else "Salma Idrissi."}]
            else:
                suffix = "getAccount" if web else "getCustomer"
                functions = [f["name"] for t in request["tools"] for f in t["functionDeclarations"]]
                name = next((n for n in functions if n.endswith(suffix)), None)
                assert name, f"Missing {suffix} among the tools: {functions}"
                args = {"id": ACCOUNT if web else 1}
                answer["parts"] = [{"functionCall": {"name": name, "args": args},
                                    "thoughtSignature": THOUGHT_SIGNATURE}]
        else:
            raise AssertionError("Unexpected model question: " + question)
        return {"candidates": [{"content": answer, "finishReason": "STOP", "index": 0}],
                "modelVersion": "fixture",
                "usageMetadata": {"promptTokenCount": 20, "candidatesTokenCount": 10,
                                  "totalTokenCount": 30}}


def verify():
    with ThreadingHTTPServer(("127.0.0.1", 0), Providers) as server:
        server.deliver = threading.Event()
        server.confirmed = threading.Event()
        server.sent = []
        server.errors = []
        threading.Thread(target=server.serve_forever, daemon=True).start()
        providers = f"http://127.0.0.1:{server.server_port}"
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        jar, = (ROOT / "chatbot-service" / "target").glob("chatbot-service-*.jar")
        base = f"http://127.0.0.1:{port}"
        log_path = ROOT / ".local/logs/chat-flow-test.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        environment = {**os.environ, "GOOGLE_GEMINI_BASE_URL": providers,
                       "GOOGLE_GENAI_USE_VERTEXAI": "false"}
        with log_path.open("wb") as log:
            process = subprocess.Popen([
                "java", "-Xmx192m", "-XX:ActiveProcessorCount=2", "-jar", str(jar),
                f"--server.port={port}", "--eureka.client.enabled=false",
                "--spring.ai.google.genai.api-key=fixture", "--spring.ai.google.genai.chat.model=fixture",
                "--telegram.bot-token=fixture", f"--telegram.api-root={providers}"
            ], cwd=ROOT, env=environment, stdout=log, stderr=subprocess.STDOUT)
        try:
            for _ in range(90):
                if process.poll() is not None:
                    raise RuntimeError("Test chatbot exited")
                try:
                    with urlopen(base + "/actuator/health", timeout=2):
                        break
                except URLError:
                    time.sleep(1)
            else:
                raise RuntimeError("Test chatbot did not start")
            session = str(uuid4())
            def ask(text):
                return post(base + "/api/chat", {"conversationId": session, "message": text})["answer"]
            assert ask(WEB_QUESTION) == "45 200 MAD, Salma Idrissi."
            assert ask(FOLLOW_UP) == ACCOUNT
            server.deliver.set()
            assert server.confirmed.wait(20), "Telegram update was not acknowledged"
            assert server.sent == [{"chat_id": 101, "text": "Salma Idrissi."}], server.sent
            try:
                post(base + "/api/chat", {"conversationId": str(uuid4()),
                                         "message": REJECTED_QUESTION})
                raise AssertionError("Rejected Gemini request should return HTTP 503")
            except HTTPError as error:
                assert error.code == 503, error
            assert not server.errors, server.errors
            print("PASS: Gemini API authentication, tool calls and thought signatures, web chat,"
                  " account MCP + Feign, conversation memory, separate Telegram chat, customer MCP,"
                  " sendMessage, update acknowledgement and provider failure handling.")
        except Exception:
            print(f"Provider errors: {server.errors}. See {log_path}", file=sys.stderr)
            raise
        finally:
            process.terminate()
            process.wait(timeout=15)
            server.shutdown()


if __name__ == "__main__":
    verify()
