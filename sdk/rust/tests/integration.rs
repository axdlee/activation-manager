// Rust SDK 集成测试：本地 mock 服务（Python test_server.py 风格，内嵌 Rust 起服务太重——用 std::net 手写）
use activation_manager_sdk::{Client, ClientOptions, ErrorKind};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::thread;

const SECRET: &str = "test-secret";

fn start_mock() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let handle = thread::spawn(move || {
        use sha2::{Digest, Sha256};
        use hmac::{Hmac, Mac};
        for stream in listener.incoming() {
            let mut stream = match stream { Ok(s) => s, Err(_) => break };
            let mut buf = vec![0u8; 4096];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request = String::from_utf8_lossy(&buf[..n]).to_string();
            let body_start = request.find("\r\n\r\n").map(|i| i + 4).unwrap_or(n);
            let body = &request[body_start..];
            let req: serde_json::Value = serde_json::from_str(body).unwrap_or(serde_json::json!({}));

            let payload = if req.get("code").and_then(|c| c.as_str()) == Some("BAD") {
                serde_json::json!({"success": false, "message": "激活码不存在"})
            } else {
                serde_json::json!({"success": true, "licenseMode": "COUNT", "license_mode": "COUNT", "remainingCount": 9, "valid": true})
            };
            let payload_str = payload.to_string();

            // 全部响应都带正确签名（验签失败路径由 wrong-secret client 覆盖）
            let mut headers = String::from("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n");
            let mut mac = Hmac::<Sha256>::new_from_slice(SECRET.as_bytes()).unwrap();
            mac.update(payload_str.as_bytes());
            let sig = hex::encode(mac.finalize().into_bytes());
            let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
            headers.push_str(&format!("x-license-signature: {}\r\nx-license-timestamp: {}\r\n", sig, ts));
            headers.push_str(&format!("Content-Length: {}\r\n\r\n", payload_str.len()));
            let _ = stream.write_all(headers.as_bytes());
            let _ = stream.write_all(payload_str.as_bytes());
        }
    });
    std::mem::forget(handle); // 后台线程随测试进程退出
    format!("http://127.0.0.1:{}", port)
}

#[test]
fn activate_success_and_signature() {
    let base = start_mock();
    let client = Client::new(ClientOptions {
        base_url: base.clone(),
        project_key: "demo".into(),
        response_secret: SECRET.into(),
        ..Default::default()
    });

    let r = client.activate("CODE-1", "m-1", None).unwrap();
    assert!(r.success);
    assert_eq!(r.license_mode.as_deref(), Some("COUNT"));
    assert_eq!(r.remaining_count, Some(9));

    // 业务失败透传（不抛异常）
    let bad = client.status("BAD", "m-1", None).unwrap();
    assert!(!bad.success);
    assert!(bad.message.is_some());

    // 验签失败（错误密钥）
    let bad_client = Client::new(ClientOptions {
        base_url: base.clone(),
        response_secret: "wrong".into(),
        ..Default::default()
    });
    let err = bad_client.status("CODE-1", "m", None).unwrap_err();
    assert!(err.kind == ErrorKind::SignatureInvalid || err.kind == ErrorKind::SignatureMissing);
}

#[test]
fn consume_retry_rules() {
    // 无 requestId 时 allow_retry=false：单次请求（用不可达地址验证只调一次）
    let client = Client::new(ClientOptions {
        base_url: "http://127.0.0.1:1".into(), // 端口 1 不可达
        max_retries: 3,
        timeout_seconds: 1,
        ..Default::default()
    });
    let err = client.consume("C", "m", None, None).unwrap_err();
    assert!(matches!(err.kind, ErrorKind::NetworkError | ErrorKind::Timeout));
    // 单次尝试即返回（attempt_count == 1）
    assert_eq!(err.attempt_count, 1);
}
