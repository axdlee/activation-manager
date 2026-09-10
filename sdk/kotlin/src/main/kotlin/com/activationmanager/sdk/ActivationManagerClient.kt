package com.activationmanager.sdk

import java.io.IOException
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Activation Manager License API SDK (Kotlin)
 *
 * 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Kotlin 实现（JVM，Java 17+ 标准库）：
 *  - activate / status / consume 三个正式接口
 *  - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
 *  - 可选 projectKey 默认值，单次调用可覆盖
 *  - 超时 / 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
 *  - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
 *
 * 用法：
 *   val client = ActivationManagerClient(ActivationManagerClient.Options(
 *       baseUrl = "http://127.0.0.1:3000", projectKey = "browser-plugin"))
 *   val result = client.activate("A1B2C3D4E5F6G7H8", "machine-001")
 *   if (!result.success) println("激活失败: ${result.message}")
 */
class ActivationManagerClient(private val options: Options) {

    data class Options(
        val baseUrl: String = "http://127.0.0.1:3000",
        val projectKey: String = "default",
        val timeoutSeconds: Long = 10,
        val maxRetries: Int = 0,
        val retryDelayMs: Long = 200,
        val responseSecret: String = "",
    )

    enum class ErrorKind {
        NETWORK_ERROR, TIMEOUT, INVALID_RESPONSE, HTTP_ERROR,
        SIGNATURE_MISSING, SIGNATURE_EXPIRED, SIGNATURE_INVALID,
    }

    /** 网络异常/超时/签名失败时抛出；业务失败通过 result.success=false 判断。 */
    class ClientException(
        val kind: ErrorKind,
        message: String,
        val path: String = "",
        val attemptCount: Int = 1,
    ) : RuntimeException(message)

    /** 服务端响应（双字段归一化取值）。 */
    class Result(private val raw: Map<String, Any?>) {
        val success: Boolean get() = raw["success"] == true
        val message: String? get() = raw["message"] as? String
        val licenseMode: String?
            get() = (raw["licenseMode"] as? String)?.takeIf { it.isNotEmpty() }
                ?: raw["license_mode"] as? String
        val expiresAt: String?
            get() = (raw["expiresAt"] as? String)?.takeIf { it.isNotEmpty() }
                ?: raw["expires_at"] as? String
        @Suppress("UNCHECKED_CAST")
        val remainingCount: Long?
            get() = (raw["remainingCount"] as? Number)?.toLong()
                ?: (raw["remaining_count"] as? Number)?.toLong()
        val isActivated: Boolean?
            get() = raw["isActivated"] as? Boolean ?: raw["is_activated"] as? Boolean
        val valid: Boolean? get() = raw["valid"] as? Boolean
        val idempotent: Boolean? get() = raw["idempotent"] as? Boolean
    }

    private val http: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(options.timeoutSeconds))
        .build()

    fun activate(code: String, machineId: String, projectKey: String? = null): Result =
        call("/api/license/activate", code, machineId, null, projectKey, allowRetry = true)

    fun status(code: String, machineId: String, projectKey: String? = null): Result =
        call("/api/license/status", code, machineId, null, projectKey, allowRetry = true)

    /** 消费：COUNT 型扣减 1 次（requestId 幂等）；TIME 型仅校验。重试仅在有 requestId 时启用。 */
    fun consume(code: String, machineId: String, requestId: String? = null, projectKey: String? = null): Result =
        call("/api/license/consume", code, machineId, requestId, projectKey, allowRetry = !requestId.isNullOrEmpty())

    private fun call(
        path: String,
        code: String,
        machineId: String,
        requestId: String?,
        projectKey: String?,
        allowRetry: Boolean,
    ): Result {
        val pk = projectKey?.takeIf { it.isNotEmpty() } ?: options.projectKey
        val payload = buildString {
            append("{\"code\":\"").append(escape(code))
            append("\",\"machineId\":\"").append(escape(machineId))
            if (!requestId.isNullOrEmpty()) {
                append("\",\"requestId\":\"").append(escape(requestId))
            }
            append("\",\"projectKey\":\"").append(escape(pk))
            append("\"}")
        }

        val totalAttempts = if (allowRetry && options.maxRetries > 0) options.maxRetries + 1 else 1
        var lastError: ClientException? = null
        for (attempt in 1..totalAttempts) {
            try {
                return attemptOnce(path, payload, attempt)
            } catch (e: ClientException) {
                lastError = e
                if (attempt < totalAttempts) Thread.sleep(options.retryDelayMs)
            }
        }
        throw lastError!!
    }

    private fun attemptOnce(path: String, payload: String, attempt: Int): Result {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(options.baseUrl.trimEnd('/') + path))
            .timeout(Duration.ofSeconds(options.timeoutSeconds))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
            .build()

        val response: HttpResponse<String> = try {
            http.send(request, HttpResponse.BodyHandlers.ofString())
        } catch (e: java.net.http.HttpTimeoutException) {
            throw ClientException(ErrorKind.TIMEOUT, "request timed out", path, attempt)
        } catch (e: IOException) {
            throw ClientException(ErrorKind.NETWORK_ERROR, e.message ?: "network error", path, attempt)
        }

        val raw = response.body()
        if (options.responseSecret.isNotEmpty()) {
            verifySignature(response.headers(), raw)
        }

        val parsed = SimpleJson.parse(raw) ?: throw ClientException(
            ErrorKind.INVALID_RESPONSE, "response is not a JSON object", path, attempt,
        )

        if (response.statusCode() >= 400 && !parsed.containsKey("success")) {
            throw ClientException(ErrorKind.HTTP_ERROR, "HTTP ${response.statusCode()}", path, attempt)
        }
        return Result(parsed)
    }

    private fun verifySignature(headers: java.net.http.HttpHeaders, rawBody: String) {
        val signature = headers.firstValue(SIGNATURE_HEADER).orElse("")
        val timestamp = headers.firstValue(TIMESTAMP_HEADER).orElse("")
        if (signature.isEmpty() || timestamp.isEmpty()) {
            throw ClientException(ErrorKind.SIGNATURE_MISSING, "missing signature headers")
        }
        val ts = timestamp.toLongOrNull() ?: throw ClientException(
            ErrorKind.SIGNATURE_INVALID, "invalid signature timestamp",
        )
        if (Math.abs(System.currentTimeMillis() - ts) > SIGNATURE_MAX_AGE_MS) {
            throw ClientException(ErrorKind.SIGNATURE_EXPIRED, "signature timestamp outside window")
        }
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(options.responseSecret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256"))
        val expected = mac.doFinal(rawBody.toByteArray(StandardCharsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        if (!MessageDigest.isEqual(
                expected.toByteArray(StandardCharsets.UTF_8),
                signature.toByteArray(StandardCharsets.UTF_8),
            )
        ) {
            throw ClientException(ErrorKind.SIGNATURE_INVALID, "response signature mismatch")
        }
    }

    companion object {
        const val SIGNATURE_HEADER = "x-license-signature"
        const val TIMESTAMP_HEADER = "x-license-timestamp"
        const val SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000L

        private fun escape(s: String): String =
            s.replace("\\", "\\\\").replace("\"", "\\\"")

        /** 极简 JSON 扁平对象解析（本 SDK 只需一层对象；避免第三方依赖）。 */
        internal object SimpleJson {
            fun parse(json: String): Map<String, Any?>? {
                val s = json.trim()
                if (!s.startsWith("{") || !s.endsWith("}")) return null
                val out = mutableMapOf<String, Any?>()
                val body = s.substring(1, s.length - 1)
                var i = 0
                while (i < body.length) {
                    val keyStart = body.indexOf('"', i)
                    if (keyStart < 0) break
                    var keyEnd = body.indexOf('"', keyStart + 1)
                    while (keyEnd > 0 && body[keyEnd - 1] == '\\') keyEnd = body.indexOf('"', keyEnd + 1)
                    if (keyEnd < 0) break
                    val key = body.substring(keyStart + 1, keyEnd)
                    val colon = body.indexOf(':', keyEnd)
                    if (colon < 0) break
                    var valueStart = colon + 1
                    while (valueStart < body.length && body[valueStart] == ' ') valueStart++
                    val value: Any? = when {
                        body[valueStart] == '"' -> {
                            var vEnd = body.indexOf('"', valueStart + 1)
                            while (vEnd > 0 && body[vEnd - 1] == '\\') vEnd = body.indexOf('"', vEnd + 1)
                            i = vEnd + 1
                            body.substring(valueStart + 1, vEnd)
                        }
                        body.startsWith("true", valueStart) -> { i = valueStart + 4; true }
                        body.startsWith("false", valueStart) -> { i = valueStart + 5; false }
                        body.startsWith("null", valueStart) -> { i = valueStart + 4; null }
                        else -> {
                            var vEnd = valueStart
                            while (vEnd < body.length && body[vEnd] != ',' && body[vEnd] != '}') vEnd++
                            val token = body.substring(valueStart, vEnd).trim()
                            i = vEnd
                            token.toLongOrNull() ?: token.toDoubleOrNull() ?: token
                        }
                    }
                    out[key] = value
                    while (i < body.length && (body[i] == ',' || body[i] == ' ')) i++
                }
                return out
            }
        }
    }
}
