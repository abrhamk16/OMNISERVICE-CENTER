import http.server
import socketserver
import os
import webbrowser

PORT = 3002
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Don't cache, so your latest edits always show up
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    url = f"http://localhost:{PORT}"
    print(f"E-Delala is running at {url}  (press Ctrl+C to stop)")
    webbrowser.open(url)
    httpd.serve_forever()
