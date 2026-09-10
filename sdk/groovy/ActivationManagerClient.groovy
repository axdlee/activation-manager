/**
 * ActivationManager License API SDK (Groovy / JVM)
 *
 * 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Groovy 实现：
 *  - activate / status / consume 三个正式接口
 *  - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
 *  - 可选 projectKey 默认值，单次调用可覆盖
 *  - 超时 / 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
 *  - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
 *
 * 零第三方依赖（JVM 标准 java.net.http + javax.crypto + groovy-json）。
 * 用法：
 *   def client = new ActivationManagerClient(baseUrl: 'http://127.0.0.1:3000', projectKey: 'browser-plugin')
 *   def result = client.activate('A1B2C3D4E5F6G7H8', 'machine-001')
 *   if (!result.success) println "激活失败: ${result.message}"
 */

import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.security.MessageDigest

class ActivationManagerClientException extends RuntimeException {
    String kind
    String path
    int attemptCount

    ActivationManagerClientException(String kind, String message, String path = '', int attemptCount = 1) {
        super(message)
        this.kind = kind
        this.path = path
        this.attemptCount = attemptCount
    }
}

class ActivationManagerClient {
    static final String SIGNATURE_HEADER = 'x-license-signature'
    static final String TIMESTAMP_HEADER = 'x-license-timestamp'
    static final long SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000L

    String baseUrl = 'http://127.0.0.1:3000'
    String projectKey = 'default'
    int timeoutSeconds = 10
    int maxRetries = 0
    long retryDelayMs = 200
    Map<String, String> headers = [:]
    String responseSecret = ''

    private final HttpClient http

    ActivationManagerClient(Map<String, ?> config = [:]) {
        if (config.baseUrl) baseUrl = config.baseUrl as String
        if (config.containsKey('projectKey')) projectKey = config.projectKey as String
        if (config.timeoutSeconds) timeoutSeconds = config.timeoutSeconds as int
        if (config.maxRetries) maxRetries = config.maxRetries as int
        if (config.retryDelayMs) retryDelayMs = config.retryDelayMs as long
        if (config.headers) headers = config.headers as Map<String, String>
        if (config.containsKey('responseSecret')) responseSecret = config.responseSecret as String
        http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(timeoutSeconds)).build()
    }

    /** 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。 */
    Map activate(String code, String machineId, String projectKey = null) {
        call('/api/license/activate', code, machineId, null, projectKey, true)
    }

    /** 查询状态：剩余次数 / 过期时间 / 是否已绑定。 */
    Map status(String code, String machineId, String projectKey = null) {
        call('/api/license/status', code, machineId, null, projectKey, true)
    }

    /** 消费：COUNT 型扣减 1 次（requestId 幂等）；TIME 型仅校验。重试仅在有 requestId 时启用。 */
    Map consume(String code, String machineId, String requestId = null, String projectKey = null) {
        boolean allowRetry = requestId != null && !requestId.isEmpty()
        call('/api/license/consume', code, machineId, requestId, projectKey, allowRetry)
    }

    private Map call(String path, String code, String machineId, String requestId, String projectKey, boolean allowRetry) {
        String pk = projectKey ?: projectKey != null ? projectKey : this.projectKey
        Map payload = [code: code, machineId: machineId, projectKey: pk]
        if (requestId) payload.requestId = requestId

        String body = JsonOutput.toJson(payload)
        int totalAttempts = (allowRetry && maxRetries > 0) ? maxRetries + 1 : 1

        ActivationManagerClientException last = null
        for (int attempt in 1..totalAttempts) {
            try {
                return attemptOnce(path, body, attempt)
            } catch (ActivationManagerClientException e) {
                last = e
                if (attempt < totalAttempts) Thread.sleep(retryDelayMs)
            }
        }
        throw last
    }

    private Map attemptOnce(String path, String body, int attempt) {
        def request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header('Content-Type', 'application/json')
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build()

        HttpResponse<String> response
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString())
        } catch (java.net.http.HttpTimeoutException e) {
            throw new ActivationManagerClientException('TIMEOUT', 'request timed out', path, attempt)
        } catch (IOException e) {
            throw new ActivationManagerClientException('NETWORK_ERROR', e.message ?: 'network error', path, attempt)
        }

        String raw = response.body()
        if (responseSecret) {
            verifySignature(response.headers(), raw)
        }

        Object parsed = new JsonSlurper().parseText(raw)
        if (!(parsed instanceof Map)) {
            throw new ActivationManagerClientException('INVALID_RESPONSE', 'response is not a JSON object', path, attempt)
        }
        Map map = parsed as Map

        if (response.statusCode() >= 400 && !map.containsKey('success')) {
            throw new ActivationManagerClientException('HTTP_ERROR', "HTTP ${response.statusCode()}", path, attempt)
        }

        // 双字段归一：camelCase 优先
        def pick = { String camel, String snake -> map[camel] != null ? map[camel] : map[snake] }
        return [
            success      : map.success == true,
            message      : map.message,
            license_mode : pick('licenseMode', 'license_mode'),
            expires_at   : pick('expiresAt', 'expires_at'),
            remaining_count : pick('remainingCount', 'remaining_count'),
            is_activated : pick('isActivated', 'is_activated'),
            valid        : map.valid,
            idempotent   : map.idempotent,
            raw_body     : raw,
        ]
    }

    private void verifySignature(HttpResponse.Headers headers, String rawBody) {
        String signature = headers.firstValue(SIGNATURE_HEADER).orElse('')
        String timestamp = headers.firstValue(TIMESTAMP_HEADER).orElse('')
        if (!signature || !timestamp) {
            throw new ActivationManagerClientException('SIGNATURE_MISSING', 'missing signature headers')
        }
        long ts
        try {
            ts = Long.parseLong(timestamp)
        } catch (NumberFormatException ignored) {
            throw new ActivationManagerClientException('SIGNATURE_INVALID', 'invalid signature timestamp')
        }
        long now = System.currentTimeMillis()
        if (Math.abs(now - ts) > SIGNATURE_MAX_AGE_MS) {
            throw new ActivationManagerClientException('SIGNATURE_EXPIRED', 'signature timestamp outside window')
        }
        Mac mac = Mac.getInstance('HmacSHA256')
        mac.init(new SecretKeySpec(responseSecret.getBytes('UTF-8'), 'HmacSHA256'))
        String expected = mac.doFinal(rawBody.getBytes('UTF-8')).encodeHex().toString()
        if (!MessageDigest.isEqual(expected.getBytes('UTF-8'), signature.getBytes('UTF-8'))) {
            throw new ActivationManagerClientException('SIGNATURE_INVALID', 'response signature mismatch')
        }
    }
}
