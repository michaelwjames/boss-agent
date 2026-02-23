import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

from dotenv import load_dotenv, find_dotenv

from jules_client import JulesClient


class JulesGuiHandler(BaseHTTPRequestHandler):
    client = None

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, content):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content.encode("utf-8"))

    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _require_client(self):
        if self.client is None:
            raise RuntimeError("Jules client not initialized")

    def _handle_error(self, exc):
        self._send_json({"error": str(exc)}, status=500)

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            query = parse_qs(parsed.query)

            self._send_cors()

            # Serve HTML from root
            if path == "/" or path == "/gui.html":
                script_dir = os.path.dirname(os.path.abspath(__file__))
                html_path = os.path.join(script_dir, "gui.html")
                with open(html_path, "r") as f:
                    self._send_html(f.read())
                return

            if path == "/api/health":
                return self._send_json({"status": "ok"})

            if path == "/api/config":
                return self._send_json({"hasApiKey": self.client is not None})

            self._require_client()

            if path == "/api/sources":
                page_size = int(query.get("pageSize", [30])[0])
                filter_expr = query.get("filter", [None])[0]
                data = self.client.list_sources(page_size=page_size, filter_expr=filter_expr)
                return self._send_json(data)

            if path.startswith("/api/sources/"):
                source_id = path.split("/api/sources/")[-1]
                data = self.client.get_source(source_id)
                return self._send_json(data)

            if path == "/api/sessions":
                page_size = int(query.get("pageSize", [30])[0])
                page_token = query.get("pageToken", [None])[0]
                data = self.client.list_sessions(page_size=page_size, page_token=page_token)
                return self._send_json(data)

            if path.startswith("/api/sessions/") and path.endswith("/activities"):
                session_id = path.split("/api/sessions/")[-1].split("/activities")[0]
                page_size = int(query.get("pageSize", [50])[0])
                page_token = query.get("pageToken", [None])[0]
                create_time = query.get("createTime", [None])[0]
                data = self.client.list_activities(
                    session_id=session_id,
                    page_size=page_size,
                    page_token=page_token,
                    create_time=create_time,
                )
                return self._send_json(data)

            if path.startswith("/api/sessions/"):
                session_id = path.split("/api/sessions/")[-1]
                data = self.client.get_session(session_id)
                return self._send_json(data)

            return self._send_json({"error": "Not found"}, status=404)
        except Exception as exc:
            self._handle_error(exc)

    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            payload = self._read_json()

            self._send_cors()

            if path == "/api/init":
                api_key = payload.get("apiKey") or os.getenv("JULES_API_KEY")
                if not api_key:
                    return self._send_json({"error": "API key required"}, status=400)
                JulesGuiHandler.client = JulesClient(api_key)
                return self._send_json({"status": "initialized"})

            self._require_client()

            if path == "/api/sessions":
                data = self.client.create_session(
                    prompt=payload["prompt"],
                    title=payload.get("title"),
                    source_id=payload.get("sourceId"),
                    starting_branch=payload.get("branch", "main"),
                    require_plan_approval=payload.get("requirePlanApproval", False),
                    automation_mode=payload.get("automationMode", "AUTOMATION_MODE_UNSPECIFIED"),
                )
                return self._send_json(data)

            if path.startswith("/api/sessions/") and path.endswith("/delete"):
                session_id = path.split("/api/sessions/")[-1].split("/delete")[0]
                self.client.delete_session(session_id)
                return self._send_json({"status": "deleted"})

            if path.startswith("/api/sessions/") and path.endswith("/message"):
                session_id = path.split("/api/sessions/")[-1].split("/message")[0]
                message = payload.get("message", "")
                data = self.client.send_message(session_id, message)
                return self._send_json(data or {"status": "sent"})

            if path.startswith("/api/sessions/") and path.endswith("/approve"):
                session_id = path.split("/api/sessions/")[-1].split("/approve")[0]
                data = self.client.approve_plan(session_id)
                return self._send_json(data or {"status": "approved"})

            return self._send_json({"error": "Not found"}, status=404)
        except Exception as exc:
            self._handle_error(exc)


def create_server(host="127.0.0.1", port=5055):
    # Load .env from the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, ".env")
    load_dotenv(env_path)
    
    api_key = os.getenv("JULES_API_KEY")
    if api_key:
        JulesGuiHandler.client = JulesClient(api_key)
        print(f"Jules client initialized with API key from .env")

    server = HTTPServer((host, port), JulesGuiHandler)
    print(f"Jules GUI server running at http://{host}:{port}")
    return server


if __name__ == "__main__":
    create_server().serve_forever()
