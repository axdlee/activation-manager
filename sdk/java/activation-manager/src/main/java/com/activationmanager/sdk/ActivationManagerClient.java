// ActivationManager License API SDK (Java 11+)
//
// 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Java 单文件实现：
//   - activate / status / consume 三个正式接口（/api/verify 兼容接口不提供）
//   - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
//   - 可选 projectKey 默认值，单次调用可覆盖
//   - 超时 / 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
//   - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
//
// 仅依赖 JDK 标准库（java.net.http / javax.crypto / java.util）。
package com.activationmanager.sdk;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

public final class ActivationManagerClient {

    public static final String SIGNATURE_HEADER = "x-license-signature";
    public static final String TIMESTAMP_HEADER = "x-license-timestamp";
    public static final long SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000L;

    /** 错误分类，与 JS/Python SDK 对齐。 */
    public enum ErrorKind { NETWORK_ERROR, TIMEOUT, INVALID_RESPONSE, HTTP_ERROR, SIGNATURE_MISSING, SIGNATURE_EXPIRED, SIGNATURE_INVALID }

    /** 网络异常/超时/签名失败时抛出；业务失败通过 result.success=false 判断。 */
    public static final class ClientException extends RuntimeException {
        public final ErrorKind kind;
        public final String path;
        public final int attemptCount;

        ClientException(ErrorKind kind, String message, String path, int attemptCount) {
            super(message);
            this.kind = kind;
            this.path = path;
            this.attemptCount = attemptCount;
        }
    }

    /** 服务端响应（双字段归一化取值）。 */
    public static final class Result {
        private final Map<String, Object> raw;

        Result(Map<String, Object> raw) { this.raw = raw; }

        public boolean isSuccess() { return Boolean.TRUE.equals(raw.get("success")); }
        public String getMessage() { return str("message"); }
        /** licenseMode（camelCase 优先，回退 snake_case） */
        public String getLicenseMode() { return firstNonEmpty(str("licenseMode"), str("license_mode")); }
        public String getExpiresAt() { return firstNonEmpty(str("expiresAt"), str("expires_at")); }
        public Optional<Long> getRemainingCount() { return firstNonNull(num("remainingCount"), num("remaining_count")); }
        public Optional<Boolean> getIsActivated() { return firstNonNullBool(bool("isActivated"), bool("is_activated")); }
        public Optional<Boolean> getValid() { return bool("valid"); }
        public Optional<Boolean> getIdempotent() { return bool("idempotent"); }

        private String str(String key) {
            Object v = raw.get(key);
            return v == null ? null : String.valueOf(v);
        }

        private Optional<Long> num(String key) {
            Object v = raw.get(key);
            if (v instanceof Number n) return Optional.of(n.longValue());
            return Optional.empty();
        }

        private Optional<Boolean> bool(String key) {
            Object v = raw.get(key);
            if (v instanceof Boolean b) return Optional.of(b);
            return Optional.empty();
        }

        private static String firstNonEmpty(String a, String b) {
            return a != null && !a.isEmpty() ? a : b;
        }

        private static Optional<Long> firstNonNull(Optional<Long> a, Optional<Long> b) {
            return a.isPresent() ? a : b;
        }

        private static Optional<Boolean> firstNonNullBool(Optional<Boolean> a, Optional<Boolean> b) {
            return a.isPresent() ? a : b;
        }

        Map<String, Object> raw() { return raw; }
    }

    /** 客户端配置。 */
    public static final class ClientOptions {
        public String baseUrl = "http://127.0.0.1:3000";
        public String projectKey = "default";
        public Duration timeout = Duration.ofSeconds(10);
        public int maxRetries = 0;
        public long retryDelayMs = 200;
        public Map<String, String> headers = Map.of();
        public String responseSecret = "";
    }

    private final ClientOptions opts;
    private final HttpClient http;

    public ActivationManagerClient(ClientOptions opts) {
        this.opts = opts;
        this.http = HttpClient.newBuilder().connectTimeout(opts.timeout).build();
    }

    /** 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。 */
    public Result activate(String code, String machineId) { return call("/api/license/activate", code, machineId, Optional.empty(), Optional.empty(), true); }

    public Result activate(String code, String machineId, String projectKey) {
        return call("/api/license/activate", code, machineId, Optional.empty(), Optional.ofNullable(projectKey), true);
    }

    /** 查询状态：剩余次数 / 过期时间 / 是否已绑定。 */
    public Result status(String code, String machineId) { return call("/api/license/status", code, machineId, Optional.empty(), Optional.empty(), true); }

    public Result status(String code, String machineId, String projectKey) {
        return call("/api/license/status", code, machineId, Optional.empty(), Optional.ofNullable(projectKey), true);
    }

    /** 消费：COUNT 型扣减 1 次（requestId 幂等）；TIME 型仅校验。重试仅在有 requestId 时启用。 */
    public Result consume(String code, String machineId, String requestId) {
        return call("/api/license/consume", code, machineId, Optional.ofNullable(requestId), Optional.empty(), requestId != null && !requestId.isEmpty());
    }

    public Result consume(String code, String machineId, String requestId, String projectKey) {
        return call("/api/license/consume", code, machineId, Optional.ofNullable(requestId), Optional.ofNullable(projectKey), requestId != null && !requestId.isEmpty());
    }

    private Result call(String path, String code, String machineId, Optional<String> requestId, Optional<String> projectKey, boolean allowRetry) {
        String pk = projectKey.filter(s -> !s.isEmpty()).orElseGet(() -> opts.projectKey == null || opts.projectKey.isEmpty() ? "default" : opts.projectKey);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("code", code);
        payload.put("machineId", machineId);
        requestId.ifPresent(id -> payload.put("requestId", id));
        payload.put("projectKey", pk);

        String body = Json.write(payload);
        int totalAttempts = allowRetry && opts.maxRetries > 0 ? opts.maxRetries + 1 : 1;

        ClientException last = null;
        for (int attempt = 1; attempt <= totalAttempts; attempt++) {
            try {
                return attempt(path, body, attempt);
            } catch (ClientException e) {
                last = e;
                if (attempt < totalAttempts) {
                    try { Thread.sleep(opts.retryDelayMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                }
            }
        }
        throw last;
    }

    private Result attempt(String path, String body, int attempt) {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(opts.baseUrl + path))
                .timeout(opts.timeout)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        opts.headers.forEach(builder::header);

        HttpResponse<String> resp;
        try {
            resp = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        } catch (java.net.http.HttpTimeoutException e) {
            throw new ClientException(ErrorKind.TIMEOUT, "request timed out", path, attempt);
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new ClientException(ErrorKind.NETWORK_ERROR, String.valueOf(e.getMessage()), path, attempt);
        }

        String raw = resp.body();
        if (opts.responseSecret != null && !opts.responseSecret.isEmpty()) {
            verifySignature(resp.headers(), raw, opts.responseSecret);
        }

        Map<String, Object> parsed = Json.parse(raw);
        if (parsed == null) {
            throw new ClientException(ErrorKind.INVALID_RESPONSE, "response is not a JSON object", path, attempt);
        }

        boolean hasSuccess = parsed.containsKey("success");
        if (resp.statusCode() >= 400 && !hasSuccess) {
            throw new ClientException(ErrorKind.HTTP_ERROR, "HTTP " + resp.statusCode(), path, attempt);
        }
        return new Result(parsed);
    }

    private static void verifySignature(java.net.http.HttpHeaders headers, String rawBody, String secret) {
        String signature = headers.firstValue(SIGNATURE_HEADER).orElse("");
        String timestamp = headers.firstValue(TIMESTAMP_HEADER).orElse("");
        if (signature.isEmpty() || timestamp.isEmpty()) {
            throw new ClientException(ErrorKind.SIGNATURE_MISSING, "missing signature headers", "", 1);
        }
        long ts;
        try {
            ts = Long.parseLong(timestamp);
        } catch (NumberFormatException e) {
            throw new ClientException(ErrorKind.SIGNATURE_INVALID, "invalid signature timestamp", "", 1);
        }
        if (Math.abs(System.currentTimeMillis() - ts) > SIGNATURE_MAX_AGE_MS) {
            throw new ClientException(ErrorKind.SIGNATURE_EXPIRED, "signature timestamp outside window", "", 1);
        }
        String expected = hmacSha256Hex(rawBody, secret);
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8))) {
            throw new ClientException(ErrorKind.SIGNATURE_INVALID, "response signature mismatch", "", 1);
        }
    }

    static String hmacSha256Hex(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** 极简 JSON 工具（只覆盖本 SDK 需要的扁平对象，避免引入第三方依赖）。 */
    static final class Json {
        static String write(Map<String, Object> map) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, Object> e : map.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append(quote(e.getKey())).append(':').append(quote(String.valueOf(e.getValue())));
            }
            return sb.append('}').toString();
        }

        static Map<String, Object> parse(String json) {
            String s = json.trim();
            if (!s.startsWith("{") || !s.endsWith("}")) return null;
            Map<String, Object> out = new LinkedHashMap<>();
            String body = s.substring(1, s.length() - 1);
            int i = 0;
            while (i < body.length()) {
                int keyStart = body.indexOf('"', i);
                if (keyStart < 0) break;
                int keyEnd = body.indexOf('"', keyStart + 1);
                while (body.charAt(keyEnd - 1) == '\\') keyEnd = body.indexOf('"', keyEnd + 1);
                String key = unescape(body.substring(keyStart + 1, keyEnd));
                int colon = body.indexOf(':', keyEnd);
                if (colon < 0) break;
                int valueStart = colon + 1;
                while (valueStart < body.length() && body.charAt(valueStart) == ' ') valueStart++;
                Object value;
                if (body.charAt(valueStart) == '"') {
                    int vEnd = body.indexOf('"', valueStart + 1);
                    while (body.charAt(vEnd - 1) == '\\') vEnd = body.indexOf('"', vEnd + 1);
                    value = unescape(body.substring(valueStart + 1, vEnd));
                    i = vEnd + 1;
                } else {
                    int vEnd = valueStart;
                    while (vEnd < body.length() && ",}".indexOf(body.charAt(vEnd)) < 0) vEnd++;
                    String token = body.substring(valueStart, vEnd).trim();
                    if ("true".equals(token)) value = Boolean.TRUE;
                    else if ("false".equals(token)) value = Boolean.FALSE;
                    else if ("null".equals(token)) value = null;
                    else {
                        try { value = token.contains(".") ? Double.parseDouble(token) : Long.parseLong(token); }
                        catch (NumberFormatException e) { value = token; }
                    }
                    i = vEnd;
                }
                out.put(key, value);
                while (i < body.length() && (body.charAt(i) == ',' || body.charAt(i) == ' ')) i++;
            }
            return out;
        }

        private static String quote(String s) {
            StringBuilder sb = new StringBuilder("\"");
            for (char c : s.toCharArray()) {
                switch (c) {
                    case '"' -> sb.append("\\\"");
                    case '\\' -> sb.append("\\\\");
                    case '\n' -> sb.append("\\n");
                    case '\r' -> sb.append("\\r");
                    case '\t' -> sb.append("\\t");
                    default -> sb.append(c);
                }
            }
            return sb.append('"').toString();
        }

        private static String unescape(String s) {
            return s.replace("\\\"", "\"").replace("\\\\", "\\").replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t");
        }
    }
}
