// ActivationManagerClient.swift — Activation Manager License API SDK (Swift 5.9+)
//
// 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Swift 实现：
//  - activate / status / consume 三个正式接口
//  - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
//  - 可选 projectKey 默认值，单次调用可覆盖
//  - 超时 / 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
//  - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗，swift-crypto）
//
// 用法：
//   let client = ActivationManagerClient(options: .init(
//       baseURL: "http://127.0.0.1:3000", projectKey: "browser-plugin"))
//   let result = try client.activate(code: "A1B2C3D4E5F6G7H8", machineId: "machine-001")
//   if !result.success { print("激活失败:", result.message ?? "") }

import Foundation
#if canImport(Crypto)
import Crypto
#endif

public struct ActivationManagerClientOptions {
    public var baseURL: String
    public var projectKey: String
    public var timeoutSeconds: TimeInterval
    public var maxRetries: Int
    public var retryDelaySeconds: TimeInterval
    public var headers: [String: String]
    public var responseSecret: String

    public init(
        baseURL: String = "http://127.0.0.1:3000",
        projectKey: String = "default",
        timeoutSeconds: TimeInterval = 10,
        maxRetries: Int = 0,
        retryDelaySeconds: TimeInterval = 0.2,
        headers: [String: String] = [:],
        responseSecret: String = ""
    ) {
        self.baseURL = baseURL
        self.projectKey = projectKey
        self.timeoutSeconds = timeoutSeconds
        self.maxRetries = maxRetries
        self.retryDelaySeconds = retryDelaySeconds
        self.headers = headers
        self.responseSecret = responseSecret
    }
}

/// 错误分类，与 JS/Python/Go SDK 对齐。
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

/// 服务端响应（双字段归一化取值）。
public struct ActivationResult: Sendable {
    public let success: Bool
    public let message: String?
    public let licenseMode: String?
    public let expiresAt: String?
    public let remainingCount: Int64?
    public let isActivated: Bool?
    public let valid: Bool?
    public let idempotent: Bool?
    public let rawBody: String
}

public final class ActivationManagerClient: @unchecked Sendable {
    public static let signatureHeader = "x-license-signature"
    public static let timestampHeader = "x-license-timestamp"
    public static let signatureMaxAgeMS: Int64 = 5 * 60 * 1000

    let options: ActivationManagerClientOptions

    public init(options: ActivationManagerClientOptions) {
        self.options = options
    }

    /// 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。
    public func activate(code: String, machineId: String, projectKey: String? = nil) throws -> ActivationResult {
        try call("/api/license/activate", code: code, machineId: machineId, requestId: nil, projectKey: projectKey, allowRetry: true)
    }

    /// 查询状态：剩余次数 / 过期时间 / 是否已绑定。
    public func status(code: String, machineId: String, projectKey: String? = nil) throws -> ActivationResult {
        try call("/api/license/status", code: code, machineId: machineId, requestId: nil, projectKey: projectKey, allowRetry: true)
    }

    /// 消费：COUNT 型扣减 1 次（requestId 幂等）；TIME 型仅校验。重试仅在有 requestId 时启用。
    public func consume(code: String, machineId: String, requestId: String? = nil, projectKey: String? = nil) throws -> ActivationResult {
        let allowRetry = !(requestId ?? "").isEmpty
        return try call("/api/license/consume", code: code, machineId: machineId, requestId: requestId, projectKey: projectKey, allowRetry: allowRetry)
    }

    // MARK: - internals

    struct WirePayload: Encodable {
        let code: String
        let machineId: String
        var requestId: String?
        let projectKey: String
    }

    struct WireResponse: Decodable {
        let success: Bool?
        let message: String?
        let licenseMode: String?
        let license_mode: String?
        let expiresAt: String?
        let expires_at: String?
        let remainingCount: Int64?
        let remaining_count: Int64?
        let isActivated: Bool?
        let is_activated: Bool?
        let valid: Bool?
        let idempotent: Bool?
    }

    func call(_ path: String, code: String, machineId: String, requestId: String?, projectKey: String?, allowRetry: Bool) throws -> ActivationResult {
        let payload = WirePayload(
            code: code,
            machineId: machineId,
            requestId: requestId,
            projectKey: (projectKey?.isEmpty == false) ? projectKey! : options.projectKey
        )

        let totalAttempts = (allowRetry && options.maxRetries > 0) ? options.maxRetries + 1 : 1
        var lastError: ActivationClientError? = nil

        for attempt in 1...totalAttempts {
            do {
                return try attemptOnce(path, payload: payload, attempt: attempt)
            } catch let e as ActivationClientError {
                lastError = e
                if attempt < totalAttempts {
                    Thread.sleep(forTimeInterval: options.retryDelaySeconds)
                }
            }
        }
        throw lastError!
    }

    func attemptOnce(_ path: String, payload: WirePayload, attempt: Int) throws -> ActivationResult {
        guard var url = URLComponents(string: options.baseURL.trimmingCharacters(in: ["/"]) + path) else {
            throw ActivationClientError(kind: .invalidResponse, message: "invalid base URL", path: path, attemptCount: attempt)
        }
        url.path = path
        var request = URLRequest(url: url.url!, timeoutInterval: options.timeoutSeconds)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for (k, v) in options.headers {
            request.setValue(v, forHTTPHeaderField: k)
        }
        request.httpBody = try JSONEncoder().encode(payload)

        var responseData: Data?
        var responseHeaders: [AnyHashable: Any] = [:]
        var statusCode = 0
        var transportError: ActivationClientError? = nil

        let semaphore = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { data, response, error in
            responseData = data
            if let http = response as? HTTPURLResponse {
                statusCode = http.statusCode
                responseHeaders = http.allHeaderFields
            }
            if let error = error as NSError?, error.code == NSURLErrorTimedOut {
                transportError = ActivationClientError(kind: .timeout, message: "request timed out", path: path, attemptCount: attempt)
            } else if let error = error {
                transportError = ActivationClientError(kind: .networkError, message: error.localizedDescription, path: path, attemptCount: attempt)
            }
            semaphore.signal()
        }.resume()
        semaphore.wait()

        if let transportError = transportError {
            throw transportError
        }
        let raw = responseData.flatMap { String(data: $0, encoding: .utf8) } ?? ""

        if !options.responseSecret.isEmpty {
            let sig = responseHeaders[options.self.dynamicSignatureKey] as? String
                ?? (responseHeaders[ActivationManagerClient.signatureHeader] as? String) ?? ""
            let ts = (responseHeaders[ActivationManagerClient.timestampHeader] as? String) ?? ""
            try Self.verifySignature(signature: sig, timestamp: ts, body: raw, secret: options.responseSecret)
        }

        guard let wire = try? JSONDecoder().decode(WireResponse.self, from: Data(raw.utf8)) else {
            throw ActivationClientError(kind: .invalidResponse, message: "response is not a JSON object", path: path, attemptCount: attempt)
        }

        let hasSuccessKey = raw.contains("\"success\"")
        if statusCode >= 400 && !hasSuccessKey {
            throw ActivationClientError(kind: .httpError, message: "HTTP \(statusCode)", path: path, attemptCount: attempt)
        }

        return ActivationResult(
            success: wire.success ?? false,
            message: wire.message,
            licenseMode: wire.licenseMode ?? wire.license_mode,
            expiresAt: wire.expiresAt ?? wire.expires_at,
            remainingCount: wire.remainingCount ?? wire.remaining_count,
            isActivated: wire.isActivated ?? wire.is_activated,
            valid: wire.valid,
            idempotent: wire.idempotent,
            rawBody: raw
        )
    }

    var dynamicSignatureKey: String { ActivationManagerClient.signatureHeader }

    static func verifySignature(signature: String, timestamp: String, body: String, secret: String) throws {
        if signature.isEmpty || timestamp.isEmpty {
            throw ActivationClientError(kind: .signatureMissing, message: "missing signature headers", path: "", attemptCount: 1)
        }
        guard let ts = Int64(timestamp) else {
            throw ActivationClientError(kind: .signatureInvalid, message: "invalid signature timestamp", path: "", attemptCount: 1)
        }
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        if abs(now - ts) > signatureMaxAgeMS {
            throw ActivationClientError(kind: .signatureExpired, message: "signature timestamp outside window", path: "", attemptCount: 1)
        }
        let expected = Self.hmacSHA256Hex(body, secret: secret)
        if expected != signature {
            throw ActivationClientError(kind: .signatureInvalid, message: "response signature mismatch", path: "", attemptCount: 1)
        }
    }

    static func hmacSHA256Hex(_ data: String, secret: String) -> String {
        #if canImport(Crypto)
        let key = SymmetricKey(data: Data(secret.utf8))
        let digest = HMAC<SHA256>.authenticationCode(for: Data(data.utf8), using: key)
        return digest.map { String(format: "%02x", $0) }.joined()
        #else
        return ""
        #endif
    }
}
