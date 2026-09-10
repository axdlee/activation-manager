// ActivationManager.swift — Activation Manager License API SDK (Swift 5.9+)
//
// 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Swift 实现：
//  - activate / status / consume 三个正式接口
//  - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
//  - 可选 projectKey 默认值，单次调用可覆盖
//  - 超时 / 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
//  - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
//
// 依赖：Foundation + Crypto（Swift 5 标准库）。
// 用法：
//   let client = try ActivationManagerClient(
//       baseURL: "http://127.0.0.1:3000", projectKey: "browser-plugin")
//   let result = try await client.activate(code: "A1B2C3D4E5F6G7H8", machineId: "machine-001")
//   if !result.success { print("激活失败: \(result.message ?? "")") }

import Foundation
#if canImport(Crypto)
import Crypto
#endif

public enum ActivationErrorKind: String, Sendable {
    case networkError = "NETWORK_ERROR"
    case timeout = "TIMEOUT"
    case invalidResponse = "INVALID_RESPONSE"
    case httpError = "HTTP_ERROR"
    case signatureMissing = "SIGNATURE_MISSING"
    case signatureExpired = "SIGNATURE_EXPIRED"
    case signatureInvalid = "SIGNATURE_INVALID"
}

/// 网络异常/超时/签名失败时抛出；业务失败通过 result.success=false 判断。
public struct ActivationClientError: Error, Sendable {
    public let kind: ActivationErrorKind
    public let message: String
    public let path: String
    public let attemptCount: Int
}

/// 服务端响应（双字段归一化取值：camelCase 优先，回退 snake_case）。
public struct ActivationResult: Sendable {
    public let success: Bool
    public let message: String?
    public let licenseMode: String?
    public let expiresAt: String?
    public let remainingCount: Int64?
    public let isActivated: Bool?
    public let valid: Bool?
    public let idempotent: Bool?
    /// JSON 原文
    public let rawBody: String

    /// 原始字段访问（如需 SDK 未封装的字段）
    public let raw: [String: Any?]
}

public struct ActivationClientOptions: Sendable {
    public var baseURL: String
    public var projectKey: String
    /// 单请求超时秒数，默认 10
    public var timeoutSeconds: TimeInterval
    public var maxRetries: Int
    public var retryDelayMilliseconds: Int
    /// 响应验签密钥（服务端 licenseResponseSecret）；空 = 不验签
    public var responseSecret: String
    public var additionalHeaders: [String: String]

    public init(
        baseURL: String = "http://127.0.0.1:3000",
        projectKey: String = "default",
        timeoutSeconds: TimeInterval = 10,
        maxRetries: Int = 0,
        retryDelayMilliseconds: Int = 200,
        responseSecret: String = "",
        additionalHeaders: [String: String] = [:]
    ) {
        self.baseURL = baseURL
        self.projectKey = projectKey
        self.timeoutSeconds = timeoutSeconds
        self.maxRetries = maxRetries
        self.retryDelayMilliseconds = retryDelayMilliseconds
        self.responseSecret = responseSecret
        self.additionalHeaders = additionalHeaders
    }
}

public final class ActivationManagerClient: Sendable {
    public static let signatureHeader = "x-license-signature"
    public static let timestampHeader = "x-license-timestamp"
    public static let signatureMaxAgeMs: Int64 = 5 * 60 * 1000

    private let options: ActivationClientOptions
    private let session: URLSession

    public init(options: ActivationClientOptions = .init(), session: URLSession? = nil) {
        self.options = options
        if let session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = options.timeoutSeconds
            self.session = URLSession(configuration: config)
        }
    }

    /// 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。
    public func activate(code: String, machineId: String, projectKey: String? = nil) async throws -> ActivationResult {
        try await call(path: "/api/license/activate", code: code, machineId: machineId,
                       requestId: nil, projectKey: projectKey, allowRetry: true)
    }

    /// 查询状态：剩余次数 / 过期时间 / 是否已绑定。
    public func status(code: String, machineId: String, projectKey: String? = nil) async throws -> ActivationResult {
        try await call(path: "/api/license/status", code: code, machineId: machineId,
                       requestId: nil, projectKey: projectKey, allowRetry: true)
    }

    /// 消费：COUNT 型扣减 1 次（requestId 幂等）；TIME 型仅校验。重试仅在有 requestId 时启用。
    public func consume(code: String, machineId: String, requestId: String? = nil, projectKey: String? = nil) async throws -> ActivationResult {
        let allowRetry = !(requestId ?? "").isEmpty && options.maxRetries > 0
        return try await call(path: "/api/license/consume", code: code, machineId: machineId,
                              requestId: requestId, projectKey: projectKey, allowRetry: allowRetry)
    }

    // MARK: - Internal

    private func call(path: String, code: String, machineId: String,
                      requestId: String?, projectKey: String?, allowRetry: Bool) async throws -> ActivationResult {
        let pk = (projectKey?.isEmpty == false) ? projectKey! : options.projectKey
        var payload: [String: Any] = [
            "code": code,
            "machineId": machineId,
            "projectKey": pk,
        ]
        if let requestId, !requestId.isEmpty {
            payload["requestId"] = requestId
        }
        guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
            throw ActivationClientError(kind: .invalidResponse, message: "payload serialization failed", path: path, attemptCount: 1)
        }

        let totalAttempts = allowRetry && options.maxRetries > 0 ? options.maxRetries + 1 : 1
        var lastError: ActivationClientError?

        for attempt in 1...totalAttempts {
            do {
                return try await attemptOnce(path: path, body: body, attempt: attempt)
            } catch let error as ActivationClientError {
                lastError = error
                if attempt < totalAttempts {
                    try? await Task.sleep(nanoseconds: UInt64(options.retryDelayMilliseconds) * 1_000_000)
                }
            }
        }
        throw lastError!
    }

    private func attemptOnce(path: String, body: Data, attempt: Int) async throws -> ActivationResult {
        guard let url = URL(string: options.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path) else {
            throw ActivationClientError(kind: .networkError, message: "invalid base URL", path: path, attemptCount: attempt)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for (name, value) in options.additionalHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .timedOut {
            throw ActivationClientError(kind: .timeout, message: "request timed out", path: path, attemptCount: attempt)
        } catch {
            throw ActivationClientError(kind: .networkError, message: error.localizedDescription, path: path, attemptCount: attempt)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ActivationClientError(kind: .networkError, message: "not an HTTP response", path: path, attemptCount: attempt)
        }

        let raw = String(decoding: data, as: UTF8.self)
        if !options.responseSecret.isEmpty {
            try verifySignature(response: httpResponse, body: raw)
        }

        guard let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw ActivationClientError(kind: .invalidResponse, message: "response is not a JSON object", path: path, attemptCount: attempt)
        }

        if httpResponse.statusCode >= 400 && parsed["success"] == nil {
            throw ActivationClientError(kind: .httpError, message: "HTTP \(httpResponse.statusCode)", path: path, attemptCount: attempt)
        }

        return Self.parse(parsed, rawBody: raw)
    }

    // MARK: - Signature

    private func verifySignature(response: HTTPURLResponse, body: String) throws {
        let signature = response.value(forHTTPHeaderField: Self.signatureHeader) ?? ""
        let timestamp = response.value(forHTTPHeaderField: Self.timestampHeader) ?? ""
        if signature.isEmpty || timestamp.isEmpty {
            throw ActivationClientError(kind: .signatureMissing, message: "missing signature headers")
        }
        guard let ts = Int64(timestamp) else {
            throw ActivationClientError(kind: .signatureInvalid, message: "invalid signature timestamp")
        }
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        if abs(now - ts) > Self.signatureMaxAgeMs {
            throw ActivationClientError(kind: .signatureExpired, message: "signature timestamp outside window")
        }
        let expected = Self.hmacSha256Hex(body, secret: options.responseSecret)
        guard expected == signature else {
            throw ActivationClientError(kind: .signatureInvalid, message: "response signature mismatch")
        }
    }

    static func hmacSha256Hex(_ data: String, secret: String) -> String {
        #if canImport(Crypto)
        let key = SymmetricKey(data: Data(secret.utf8))
        let digest = HMAC<SHA256>.authenticationCode(for: Data(data.utf8), using: key)
        return digest.map { String(format: "%02x", $0) }.joined()
        #else
        return ""
        #endif
    }

    // MARK: - Response parsing（双字段归一）

    static func parse(_ json: [String: Any], rawBody: String) -> ActivationResult {
        func str(_ camel: String, _ snake: String) -> String? {
            (json[camel] as? String).flatMap { $0.isEmpty ? nil : $0 }
                ?? (json[snake] as? String).flatMap { $0.isEmpty ? nil : $0 }
        }
        func num(_ camel: String, _ snake: String) -> Int64? {
            (json[camel] as? NSNumber)?.int64Value ?? (json[snake] as? NSNumber)?.int64Value
        }
        func bool(_ camel: String, _ snake: String) -> Bool? {
            (json[camel] as? Bool) ?? (json[snake] as? Bool)
        }
        return ActivationResult(
            success: json["success"] as? Bool ?? false,
            message: json["message"] as? String,
            licenseMode: str("licenseMode", "license_mode"),
            expiresAt: str("expiresAt", "expires_at"),
            remainingCount: num("remainingCount", "remaining_count"),
            isActivated: bool("isActivated", "is_activated"),
            valid: json["valid"] as? Bool,
            idempotent: json["idempotent"] as? Bool,
            rawBody: rawBody,
            raw: json
        )
    }
}
