"""C/C++ SDK 测试用 mock 服务：python3 test_server.py <port>"""
import json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = "test-secret"
CALLS = {"consume": 0}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        req = json.loads(self.rfile.read(length) or b"{}")
        payload = json.dumps({
            "success": True, "licenseMode": "COUNT", "license_mode": "COUNT",
            "remainingCount": 9, "remaining_count": 9, "valid": True,
        })
        # 业务失败用例：code=BAD
        if req.get("code") == "BAD":
            payload = json.dumps({"success": False, "message": "激活码不存在"})
        # consume 无 requestId：第一次 500（测试不重试）
        if self.path == "/api/license/consume" and not req.get("requestId"):
            CALLS["consume"] += 1
            if CALLS["consume"] <= 2:  # 每个 consume 无 rid 用例首次
                self.send_response(500)
                self.end_headers()
                return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        if self.path != "/api/license/consume" or req.get("requestId"):
            import hashlib, hmac, time
            ts = str(round(time.time() * 1000))
            version = self.headers.get("x-license-signature-version") or ""
            code = str(req.get("code", "") or "").strip()
            mid = str(req.get("machineId", "") or "").strip()
            if version == "3":
                message = f"{ts}.{code}|{mid}.".encode() + payload.encode()
            elif version == "1":
                message = payload.encode()
            else:
                message = f"{ts}.".encode() + payload.encode()
            sig = hmac.new(SECRET.encode(), message, hashlib.sha256).hexdigest()
            self.send_header("x-license-signature", sig)
            self.send_header("x-license-timestamp", ts)
            self.send_header("x-license-signature-version", version or "2")
        self.end_headers()
        self.wfile.write(payload.encode())

HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
