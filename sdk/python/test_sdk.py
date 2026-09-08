"""Python SDK 自测脚本（本地运行，无需真实服务端）：

    python3 sdk/python/test_sdk.py

覆盖：键归一化、成功响应、业务失败透传、网络错误分类、重试、验签。
"""

import hashlib
import hmac
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

sys.path.insert(0, __file__.rsplit("/", 1)[0])

from activation_manager import (  # noqa: E402
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    LicenseClientError,
    create_client,
    _normalize_keys,
)

assert _normalize_keys({"machine_id": 1, "a_b": {"c_d": [1, {"e_f": 2}]}}) == {
    "machineId": 1,
    "aB": {"cD": [1, {"eF": 2}]},
}

SECRET = "test-secret"
calls = {"consume": 0}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _respond(self, status, payload, body_bytes=None, sign=False):
        body = body_bytes or json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        if sign:
            sig = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
            self.send_header(SIGNATURE_HEADER, sig)
            self.send_header(TIMESTAMP_HEADER, str(int(__import__("time").time() * 1000)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        if self.path == "/api/license/activate":
            assert body["projectKey"] == "demo"
            self._respond(200, {
                "success": True, "license_mode": "COUNT", "remaining_count": 9,
                "is_activated": True, "valid": True,
            })
        elif self.path == "/api/license/status":
            self._respond(200, {"success": False, "message": "激活码不存在"})
        elif self.path == "/api/license/consume":
            calls["consume"] += 1
            if calls["consume"] == 1:
                raise RuntimeError("simulated crash")
            self._respond(200, {
                "success": True, "remaining_count": 8, "idempotent": False, "valid": True,
            })
        elif self.path == "/api/license/signed":
            self._respond(200, {"success": True}, sign=True)
        elif self.path == "/api/license/badsign":
            self._respond(200, {"success": True}, sign=False)
        else:
            self._respond(404, {"success": False, "message": "not found"})


server = HTTPServer(("127.0.0.1", 0), Handler)
server.handle_error = lambda request, client_address: None  # 静默"模拟崩溃"用例的噪音
threading.Thread(target=server.serve_forever, daemon=True).start()
port = server.server_address[1]

client = create_client(base_url=f"http://127.0.0.1:{port}", project_key="demo", max_retries=2, retry_delay_seconds=0.01)

# 1. activate：snake_case 归一化为 camelCase
result = client.activate(code="CODE-1", machine_id="m-1")
assert result["success"] is True and result["licenseMode"] == "COUNT" and result["remainingCount"] == 9

# 2. status：业务失败透传（不抛异常）
result = client.status(code="BAD", machine_id="m-1")
assert result["success"] is False and result["message"] == "激活码不存在"

# 3. consume：第一次模拟崩溃，重试后成功（有 requestId 允许重试）
result = client.consume(code="CODE-1", machine_id="m-1", request_id="req-1")
assert result["success"] is True and result["remainingCount"] == 8
assert calls["consume"] == 2

# 4. consume：无 requestId 时不重试
calls["consume"] = 0
try:
    client._post = lambda *a, **k: (_ for _ in ()).throw(LicenseClientError("NETWORK_ERROR", "boom"))
    client_no_retry = create_client(base_url=f"http://127.0.0.1:{port}", max_retries=3)
    try:
        client_no_retry.consume(code="C", machine_id="m")
        raise AssertionError("should raise")
    except LicenseClientError as error:
        assert error.attempt_count == 1
finally:
    pass

# 5. 验签：正确密钥通过，错误密钥抛出
signed_client = create_client(base_url=f"http://127.0.0.1:{port}", response_secret=SECRET)
assert signed_client._post("/api/license/signed", {})["success"] is True

bad_client = create_client(base_url=f"http://127.0.0.1:{port}", response_secret="wrong")
try:
    bad_client._post("/api/license/signed", {})
    raise AssertionError("should raise")
except LicenseClientError as error:
    assert error.code in ("SIGNATURE_INVALID", "SIGNATURE_MISSING")

unsigned_client = create_client(base_url=f"http://127.0.0.1:{port}", response_secret=SECRET)
try:
    unsigned_client._post("/api/license/badsign", {})
    raise AssertionError("should raise")
except LicenseClientError as error:
    assert error.code == "SIGNATURE_MISSING"

server.shutdown()
print("✅ Python SDK 自测通过")
