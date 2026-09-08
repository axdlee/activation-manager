"""Activation Manager License API SDK (Python)

与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Python 单文件实现：
- activate / status / consume 三个正式接口（/api/verify 兼容接口不在 SDK 提供）
- 统一 camelCase 请求、响应归一化（snake_case -> camelCase）
- 可选 projectKey 默认值，单次调用可覆盖
- 超时 / 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
- 可选响应验签（服务端配置 licenseResponseSecret 后开启，HMAC-SHA256 + 5 分钟时间窗）

用法：

    from activation_manager import create_client

    client = create_client(
        base_url="http://127.0.0.1:3000",
        project_key="browser-plugin",
        timeout_seconds=10,
        max_retries=1,
        retry_delay_seconds=0.2,
    )

    result = client.activate(code="A1B2C3D4E5F6G7H8", machine_id="machine-001")
    if not result["success"]:
        print("激活失败:", result["message"])

仅依赖 Python 3.8+ 标准库（urllib / hashlib / hmac / json）。
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, Optional

SIGNATURE_HEADER = "x-license-signature"
TIMESTAMP_HEADER = "x-license-timestamp"
SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

_CAMEL_CACHE: Dict[str, str] = {}


def _snake_to_camel(key: str) -> str:
    if key in _CAMEL_CACHE:
        return _CAMEL_CACHE[key]
    parts = key.split("_")
    camel = parts[0] + "".join(p.title() for p in parts[1:])
    _CAMEL_CACHE[key] = camel
    return camel


def _normalize_keys(value: Any) -> Any:
    """递归把 snake_case 键归一化为 camelCase（SDK 对外统一 camelCase）。"""
    if isinstance(value, dict):
        return {_snake_to_camel(k): _normalize_keys(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize_keys(item) for item in value]
    return value


class LicenseClientError(Exception):
    """网络异常 / 超时 / 响应不可解析时抛出；业务失败通过返回值 success=False 判断。"""

    def __init__(self, code: str, message: str, path: str = "", attempt_count: int = 1) -> None:
        super().__init__(message)
        self.code = code
        self.path = path
        self.attempt_count = attempt_count


class ActivationManagerClient:
    def __init__(
        self,
        base_url: str,
        project_key: str = "default",
        timeout_seconds: float = 10.0,
        max_retries: int = 0,
        retry_delay_seconds: float = 0.2,
        headers: Optional[Dict[str, str]] = None,
        response_secret: str = "",
        on_retry: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.project_key = project_key
        self.timeout_seconds = timeout_seconds
        self.max_retries = max(0, int(max_retries))
        self.retry_delay_seconds = retry_delay_seconds
        self.headers = headers or {}
        self.response_secret = response_secret
        self.on_retry = on_retry

    # ---- 内部请求 ----

    def _post(self, path: str, payload: Dict[str, Any], allow_retry: bool = True) -> Dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        url = f"{self.base_url}{path}"
        attempt = 0
        last_error: Optional[LicenseClientError] = None

        while attempt <= self.max_retries:
            attempt += 1
            try:
                request = urllib.request.Request(
                    url,
                    data=body,
                    headers={
                        "Content-Type": "application/json",
                        **self.headers,
                    },
                    method="POST",
                )
                with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                    raw = response.read().decode("utf-8")
                    self._verify_signature_if_needed(response.headers, raw)
                    parsed = json.loads(raw)
                    if not isinstance(parsed, dict):
                        raise LicenseClientError("INVALID_RESPONSE", "响应不是 JSON 对象", path, attempt)
                    return _normalize_keys(parsed)  # type: ignore[return-value]
            except LicenseClientError:
                raise
            except urllib.error.HTTPError as error:
                # 服务端正常返回业务失败（HTTP 200 之外也可能带 JSON body），尝试透传
                try:
                    error_body = error.read().decode("utf-8")
                    parsed = json.loads(error_body)
                    if isinstance(parsed, dict) and "success" in parsed:
                        return _normalize_keys(parsed)  # type: ignore[return-value]
                except Exception:
                    pass
                last_error = LicenseClientError("HTTP_ERROR", f"HTTP {error.code}", path, attempt)
            except urllib.error.URLError as error:
                last_error = LicenseClientError("NETWORK_ERROR", str(error.reason), path, attempt)
            except TimeoutError:
                last_error = LicenseClientError("TIMEOUT", "请求超时", path, attempt)
            except (json.JSONDecodeError, UnicodeDecodeError):
                last_error = LicenseClientError("INVALID_RESPONSE", "响应 JSON 解析失败", path, attempt)
            except Exception as error:  # 兜底：保持与 JS SDK 错误分类对齐
                last_error = LicenseClientError("NETWORK_ERROR", str(error), path, attempt)

            if not allow_retry or attempt > self.max_retries:
                break

            if self.on_retry:
                self.on_retry({"path": path, "attempt_count": attempt, "error": last_error})
            time.sleep(self.retry_delay_seconds)

        raise last_error or LicenseClientError("NETWORK_ERROR", "请求失败", path, attempt)

    def _verify_signature_if_needed(self, response_headers: Any, raw_body: str) -> None:
        if not self.response_secret:
            return
        signature = response_headers.get(SIGNATURE_HEADER, "")
        timestamp = response_headers.get(TIMESTAMP_HEADER, "")
        if not signature or not timestamp:
            raise LicenseClientError("SIGNATURE_MISSING", "响应缺少签名头", "")
        try:
            timestamp_ms = int(timestamp)
        except ValueError:
            raise LicenseClientError("SIGNATURE_INVALID", "签名时间戳非法", "")
        if abs(time.time() * 1000 - timestamp_ms) > SIGNATURE_MAX_AGE_MS:
            raise LicenseClientError("SIGNATURE_EXPIRED", "签名时间窗过期", "")
        expected = hmac.new(
            self.response_secret.encode("utf-8"),
            raw_body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise LicenseClientError("SIGNATURE_INVALID", "响应签名校验失败", "")

    def _call(self, path: str, payload: Dict[str, Any], project_key: Optional[str], allow_retry: bool) -> Dict[str, Any]:
        request_payload = {"projectKey": project_key or self.project_key, **payload}
        return self._post(path, request_payload, allow_retry=allow_retry)

    # ---- 正式接口 ----

    def activate(self, code: str, machine_id: str, project_key: Optional[str] = None) -> Dict[str, Any]:
        """激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。"""
        return self._call("/api/license/activate", {"code": code, "machineId": machine_id}, project_key, allow_retry=True)

    def status(self, code: str, machine_id: str, project_key: Optional[str] = None) -> Dict[str, Any]:
        """查询状态：剩余次数 / 过期时间 / 是否已绑定。"""
        return self._call("/api/license/status", {"code": code, "machineId": machine_id}, project_key, allow_retry=True)

    def consume(self, code: str, machine_id: str, request_id: Optional[str] = None, project_key: Optional[str] = None) -> Dict[str, Any]:
        """消费：COUNT 型扣减 1 次（requestId 幂等）；TIME 型仅校验有效性。

        自动重试默认关闭（与 JS SDK 约定一致）：传了 requestId 才允许安全重试，
        否则客户端重试可能导致重复扣次。
        """
        payload: Dict[str, Any] = {"code": code, "machineId": machine_id}
        if request_id:
            payload["requestId"] = request_id
        return self._call("/api/license/consume", payload, project_key, allow_retry=bool(request_id) and self.max_retries > 0)


def create_client(
    base_url: str,
    project_key: str = "default",
    timeout_seconds: float = 10.0,
    max_retries: int = 0,
    retry_delay_seconds: float = 0.2,
    headers: Optional[Dict[str, str]] = None,
    response_secret: str = "",
    on_retry: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> ActivationManagerClient:
    """创建 License API 客户端（参数含义见类 docstring）。"""
    return ActivationManagerClient(
        base_url=base_url,
        project_key=project_key,
        timeout_seconds=timeout_seconds,
        max_retries=max_retries,
        retry_delay_seconds=retry_delay_seconds,
        headers=headers,
        response_secret=response_secret,
        on_retry=on_retry,
    )
