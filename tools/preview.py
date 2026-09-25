"""Local preview that behaves like GitHub Pages.

Run from the website folder:
    python tools/preview.py
then open http://localhost:8000

Clean URLs work like on the live site (/gibbs serves gibbs.html, / serves
index.html), and unknown addresses show 404.html. Stop it with Ctrl+C.
"""
import http.server
import io
import os
import socketserver

PORT = 8000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class PagesHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        local = os.path.join(ROOT, path.lstrip('/'))
        # /gibbs -> gibbs.html, like GitHub Pages
        if path != '/' and not os.path.exists(local) and os.path.exists(local + '.html'):
            self.path = path + '.html'
        elif path != '/' and not os.path.exists(local):
            with open(os.path.join(ROOT, '404.html'), 'rb') as page:
                body = page.read()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()

    def log_message(self, fmt, *args):
        pass  # keep the terminal quiet


if __name__ == '__main__':
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), PagesHandler) as httpd:
        print(f'Preview running at http://localhost:{PORT}  (Ctrl+C to stop)')
        httpd.serve_forever()
