// ActivationManager License API SDK (Rust, no_std-compatible core, edition 2021)
//
// 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Rust 实现：
//   - activate / status / consume 三个正式接口
//   - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
//   - 可选 project_key 默认值，单次调用可覆盖
//   - 超时 / 重试（仅瞬时网络错误；consume 建议配 request_id 保证幂等）
//   - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
//
// 依赖：reqwest（blocking，rustls）+ serde_json + hmac/sha2（签名）——Cargo.toml 声明。
// 用法见 tests；cargo test 运行。

use hmac::{Hmac, Mac};
use std::result::Result as StdResult;
use serde_json::{json, Value};
use sha2::Sha256;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const SIGNATURE_HEADER: &str = "x-license-signature";
pub const TIMESTAMP_HEADER: &str = "x-license-timestamp";
pub const SIGNATURE_MAX_AGE_MS: i64 = 5 * 60 * 1000;

/// 错误分类，与 JS/Python/Go SDK 对齐。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ErrorKind {
    NetworkError,
    Timeout,
    InvalidResponse,
    HttpError,
    SignatureMissing,
    SignatureExpired,
    SignatureInvalid,
}

impl std::fmt::Display for ErrorKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            ErrorKind::NetworkError => "NETWORK_ERROR",
            ErrorKind::Timeout => "TIMEOUT",
            ErrorKind::InvalidResponse => "INVALID_RESPONSE",
            ErrorKind::HttpError => "HTTP_ERROR",
            ErrorKind::SignatureMissing => "SIGNATURE_MISSING",
            ErrorKind::SignatureExpired => "SIGNATURE_EXPIRED",
            ErrorKind::SignatureInvalid => "SIGNATURE_INVALID",
        };
        write!(f, "{}", s)
    }
}

/// 网络异常/超时/签名失败时抛出；业务失败通过 result.success=false 判断。
#[derive(Debug)]
pub struct ClientError {
    pub kind: ErrorKind,
    pub message: String,
    pub path: String,
    pub attempt_count: u32,
}

impl std::fmt::Display for ClientError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {} (path={}, attempt={})", self.kind, self.message, self.path, self.attempt_count)
    }
}

impl std::error::Error for ClientError {}

/// 服务端响应（双字段归一化取值：camelCase 优先，回退 snake_case）。
#[derive(Debug, Clone)]
pub struct SdkResult {
    pub success: bool,
    pub message: Option<String>,
    pub license_mode: Option<String>,
    pub expires_at: Option<String>,
    pub remaining_count: Option<i64>,
    pub is_activated: Option<bool>,
    pub valid: Option<bool>,
    pub idempotent: Option<bool>,
    pub raw_body: String,
}

fn str_field(v: &Value, camel: &str, snake: &str) -> Option<String> {
    v.get(camel)
        .and_then(|x| x.as_str())
        .map(String::from)
        .or_else(|| v.get(snake).and_then(|x| x.as_str()).map(String::from))
}

fn num_field(v: &Value, camel: &str, snake: &str) -> Option<i64> {
    v.get(camel)
        .and_then(|x| x.as_i64())
        .or_else(|| v.get(snake).and_then(|x| x.as_i64()))
}

fn bool_field(v: &Value, camel: &str, snake: &str) -> Option<bool> {
    v.get(camel)
        .and_then(|x| x.as_bool())
        .or_else(|| v.get(snake).and_then(|x| x.as_bool()))
}

impl SdkResult {
    fn parse(body: &str) -> Option<SdkResult> {
        let v: Value = serde_json::from_str(body).ok()?;
        Some(Self {
            success: v.get("success")?.as_bool()?,
            message: v.get("message").and_then(|x| x.as_str()).map(String::from),
            license_mode: str_field(&v, "licenseMode", "license_mode"),
            expires_at: str_field(&v, "expiresAt", "expires_at"),
            remaining_count: num_field(&v, "remainingCount", "remaining_count"),
            is_activated: bool_field(&v, "isActivated", "is_activated"),
            valid: v.get("valid").and_then(|x| x.as_bool()),
            idempotent: v.get("idempotent").and_then(|x| x.as_bool()),
            raw_body: body.to_string(),
        })
    }
}

/// 客户端配置。
#[derive(Debug, Clone)]
pub struct ClientOptions {
    pub base_url: String,
    pub project_key: String,
    pub timeout_seconds: u64,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    pub response_secret: String,
}

impl Default for ClientOptions {
    fn default() -> Self {
        Self {
            base_url: "http://127.0.0.1:3000".into(),
            project_key: "default".into(),
            timeout_seconds: 10,
            max_retries: 0,
            retry_delay_ms: 200,
            response_secret: String::new(),
        }
    }
}

/// License API 客户端（blocking）。
pub struct Client {
    opts: ClientOptions,
    http: reqwest::blocking::Client,
}

impl Client {
    pub fn new(opts: ClientOptions) -> Self {
        let http = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(opts.timeout_seconds))
            .build()
            .expect("failed to build HTTP client");
        Self { opts, http }
    }

    /// 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。
    pub fn activate(&self, code: &str, machine_id: &str, project_key: Option<&str>) -> std::result::Result<SdkResult, ClientError> {
        self.call("/api/license/activate", code, machine_id, None, project_key, true)
    }

    /// 查询状态：剩余次数 / 过期时间 / 是否已绑定。
    pub fn status(&self, code: &str, machine_id: &str, project_key: Option<&str>) -> std::result::Result<SdkResult, ClientError> {
        self.call("/api/license/status", code, machine_id, None, project_key, true)
    }

    /// 消费：COUNT 型扣减 1 次（request_id 幂等）；TIME 型仅校验。
    /// 重试仅在传了 request_id 时启用（防重复扣次）。
    pub fn consume(
        &self,
        code: &str,
        machine_id: &str,
        request_id: Option<&str>,
        project_key: Option<&str>,
    ) -> std::result::Result<SdkResult, ClientError> {
        let allow_retry = request_id.map(|s| !s.is_empty()).unwrap_or(false);
        self.call("/api/license/consume", code, machine_id, request_id, project_key, allow_retry)
    }

    fn call(
        &self,
        path: &str,
        code: &str,
        machine_id: &str,
        request_id: Option<&str>,
        project_key: Option<&str>,
        allow_retry: bool,
    ) -> std::result::Result<SdkResult, ClientError> {
        let pk = project_key
            .filter(|s| !s.is_empty())
            .unwrap_or(&self.opts.project_key);

        let mut payload = json!({
            "code": code,
            "machineId": machine_id,
            "projectKey": pk,
        });
        if let Some(id) = request_id.filter(|s| !s.is_empty()) {
            payload["requestId"] = json!(id);
        }

        let total_attempts = if allow_retry && self.opts.max_retries > 0 {
            self.opts.max_retries + 1
        } else {
            1
        };

        let mut last_error: Option<ClientError> = None;
        for attempt in 1..=total_attempts {
            match self.attempt_once(path, &payload, attempt) {
                Ok(result) => return Ok(result),
                Err(e) => {
                    last_error = Some(e);
                    if attempt < total_attempts {
                        std::thread::sleep(Duration::from_millis(self.opts.retry_delay_ms));
                    }
                }
            }
        }
        Err(last_error.unwrap())
    }

    fn attempt_once(&self, path: &str, payload: &Value, attempt: u32) -> std::result::Result<SdkResult, ClientError> {
        let url = format!("{}{}", self.opts.base_url.trim_end_matches('/'), path);
        let response = self
            .http
            .post(&url)
            .header("Content-Type", "application/json")
            .json(payload)
            .send();

        let response = match response {
            Ok(r) => r,
            Err(e) if e.is_timeout() => {
                return Err(ClientError {
                    kind: ErrorKind::Timeout,
                    message: "request timed out".into(),
                    path: path.into(),
                    attempt_count: attempt,
                })
            }
            Err(e) => {
                return Err(ClientError {
                    kind: ErrorKind::NetworkError,
                    message: e.to_string(),
                    path: path.into(),
                    attempt_count: attempt,
                })
            }
        };

        let status_code = response.status().as_u16();
        let raw = response.text().map_err(|e| ClientError {
            kind: ErrorKind::NetworkError,
            message: e.to_string(),
            path: path.into(),
            attempt_count: attempt,
        })?;

        if !self.opts.response_secret.is_empty() {
            self.verify_signature(&response, &raw)?;
        }

        let result = SdkResult::parse(&raw).ok_or_else(|| ClientError {
            kind: ErrorKind::InvalidResponse,
            message: "response is not a JSON object".into(),
            path: path.into(),
            attempt_count: attempt,
        })?;

        if status_code >= 400 {
            return Err(ClientError {
                kind: ErrorKind::HttpError,
                message: format!("HTTP {}", status_code),
                path: path.into(),
                attempt_count: attempt,
            });
        }
        Ok(result)
    }

    fn verify_signature(
        &self,
        response: &reqwest::blocking::Response,
        raw_body: &str,
    ) -> Result<(), ClientError> {
        let signature = response
            .headers()
            .get(SIGNATURE_HEADER)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let timestamp = response
            .headers()
            .get(TIMESTAMP_HEADER)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if signature.is_empty() || timestamp.is_empty() {
            return Err(ClientError {
                kind: ErrorKind::SignatureMissing,
                message: "missing signature headers".into(),
                path: String::new(),
                attempt_count: 1,
            });
        }
        let ts: i64 = timestamp.parse().map_err(|_| ClientError {
            kind: ErrorKind::SignatureInvalid,
            message: "invalid signature timestamp".into(),
            path: String::new(),
            attempt_count: 1,
        })?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        if (now - ts).abs() > SIGNATURE_MAX_AGE_MS {
            return Err(ClientError {
                kind: ErrorKind::SignatureExpired,
                message: "signature timestamp outside window".into(),
                path: String::new(),
                attempt_count: 1,
            });
        }
        let mut mac = Hmac::<Sha256>::new_from_slice(self.opts.response_secret.as_bytes())
            .expect("HMAC accepts any key length");
        mac.update(raw_body.as_bytes());
        let expected = hex_encode(&mac.finalize().into_bytes());
        if expected != signature {
            return Err(ClientError {
                kind: ErrorKind::SignatureInvalid,
                message: "response signature mismatch".into(),
                path: String::new(),
                attempt_count: 1,
            });
        }
        Ok(())
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
