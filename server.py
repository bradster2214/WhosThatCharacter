import http.server
import socketserver
import json
import sys

SUPPRESS = (ConnectionAbortedError, BrokenPipeError, ConnectionResetError)
STREAK_FILE = "streak.json"


class GameHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path == "/write-streak":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length)
                data = json.loads(body)
                with open(STREAK_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                self.send_response(200)
                self.end_headers()
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        super().log_message(fmt, *args)


class QuietServer(socketserver.TCPServer):
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        if not isinstance(sys.exc_info()[1], SUPPRESS):
            super().handle_error(request, client_address)


print("Starting Who's That Character server...")
print("Open OBS Browser Source at: http://127.0.0.1:8787/index.html")
print("Close this window to stop the server.")
print()

with QuietServer(("", 8787), GameHandler) as server:
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
