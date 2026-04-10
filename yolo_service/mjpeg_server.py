"""
mjpeg_server.py
Serves the latest annotated frame as an MJPEG stream on port 8081.
The browser reads this instead of Django re-opening the RTSP.
"""
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

_latest_frame_lock = threading.Lock()
_latest_frame_jpeg = None


def update_frame(jpeg_bytes: bytes):
    global _latest_frame_jpeg
    with _latest_frame_lock:
        _latest_frame_jpeg = jpeg_bytes


class MJPEGHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress request logs

    def do_GET(self):
        if self.path.split('?', 1)[0] == '/stream':
            self.send_response(200)
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.send_header('Connection', 'close')
            self.end_headers()
            try:
                while True:
                    with _latest_frame_lock:
                        frame = _latest_frame_jpeg
                    if frame:
                        self.wfile.write(
                            b'--frame\r\n'
                            b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n'
                        )
                        self.wfile.flush()
                    time.sleep(0.033)  # ~30fps cap
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass
        else:
            self.send_response(404)
            self.end_headers()


def start_mjpeg_server(port=8081):
    server = ThreadingHTTPServer(('0.0.0.0', port), MJPEGHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"✓ MJPEG server running on http://localhost:{port}/stream")
    return server