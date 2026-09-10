// ActivationManager License API SDK (C# / .NET 8)
//
// 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 C# 实现：
//   - activate / status / consume 三个正式接口
//   - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
//   - 可选 ProjectKey 默认值，单次调用可覆盖
//   - 超时 / 重试（仅瞬时网络错误；consume 建议配 RequestId 保证幂等）
//   - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
//
// 仅依赖 .NET 标准库（System.Net.Http / System.Security.Cryptography / System.Text.Json）。
// 用法见 ActivationManagerClientTests.cs 与文件头注释。

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace ActivationManager.Sdk;

public enum ActivationErrorKind
{
    NetworkError,
    Timeout,
    InvalidResponse,
    HttpError,
    SignatureMissing,
    SignatureExpired,
    SignatureInvalid,
}

/// <summary>网络异常/超时/签名失败时抛出；业务失败通过 Result.Success=false 判断。</summary>
public sealed class ActivationClientException : Exception
{
    public ActivationErrorKind Kind { get; }
    public string Path { get; }
    public int AttemptCount { get; }

    internal ActivationClientException(ActivationErrorKind kind, string message, string path = "", int attemptCount = 1)
        : base(message)
    {
        Kind = kind;
        Path = path;
        AttemptCount = attemptCount;
    }
}

/// <summary>服务端响应（双字段归一化取值：camelCase 优先，回退 snake_case）。</summary>
public sealed class ActivationResult
{
    private readonly Dictionary<string, JsonElement> _raw;

    internal ActivationResult(Dictionary<string, JsonElement> raw) => _raw = raw;

    public bool Success => _raw.TryGetValue("success", out var v) && v.ValueKind == JsonValueKind.True;

    public string? Message => GetString("message");

    public string? LicenseMode => FirstNonEmpty(GetString("licenseMode"), GetString("license_mode"));

    public string? ExpiresAt => FirstNonEmpty(GetString("expiresAt"), GetString("expires_at"));

    public long? RemainingCount => FirstNonNull(
        GetNumber("remainingCount"),
        GetNumber("remaining_count"));

    public bool? IsActivated => FirstNonNull(
        GetBool("isActivated"),
        GetBool("is_activated"));

    public bool? Valid => GetBool("valid");

    public bool? Idempotent => GetBool("idempotent");

    private static string? FirstNonEmpty(string? a, string? b) => !string.IsNullOrEmpty(a) ? a : b;

    private static long? FirstNonNull(long? a, long? b) => a ?? b;

    private static bool? FirstNonNull(bool? a, bool? b) => a ?? b;

    private string? GetString(string key) =>
        _raw.TryGetValue(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private long? GetNumber(string key) =>
        _raw.TryGetValue(key, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt64() : null;

    private bool? GetBool(string key) =>
        _raw.TryGetValue(key, out var v)
            ? v.ValueKind switch
            {
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                _ => null,
            }
            : null;
}

/// <summary>客户端配置。</summary>
public sealed class ActivationManagerClientOptions
{
    public string BaseUrl { get; set; } = "http://127.0.0.1:3000";
    public string ProjectKey { get; set; } = "default";
    public int TimeoutSeconds { get; set; } = 10;
    public int MaxRetries { get; set; } = 0;
    public int RetryDelayMilliseconds { get; set; } = 200;
    public IReadOnlyDictionary<string, string> Headers { get; set; } = new Dictionary<string, string>();
    public string ResponseSecret { get; set; } = string.Empty;
}

public sealed class ActivationManagerClient
{
    public const string SignatureHeader = "x-license-signature";
    public const string TimestampHeader = "x-license-timestamp";
    public const long SignatureMaxAgeMs = 5 * 60 * 1000;

    private readonly ActivationManagerClientOptions _options;
    private readonly HttpClient _http;

    public ActivationManagerClient(ActivationManagerClientOptions options, HttpClient? httpClient = null)
    {
        _options = options;
        _http = httpClient ?? new HttpClient { Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds) };
    }

    /// <summary>测试/高级场景：注入自定义 HttpMessageHandler。</summary>
    public ActivationManagerClient(ActivationManagerClientOptions options, HttpMessageHandler handler)
    {
        _options = options;
        _http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds) };
    }

    /// <summary>激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。</summary>
    public Task<ActivationResult> ActivateAsync(string code, string machineId, string? projectKey = null, CancellationToken ct = default) =>
        CallAsync("/api/license/activate", code, machineId, null, projectKey, allowRetry: true, ct);

    /// <summary>查询状态：剩余次数 / 过期时间 / 是否已绑定。</summary>
    public Task<ActivationResult> StatusAsync(string code, string machineId, string? projectKey = null, CancellationToken ct = default) =>
        CallAsync("/api/license/status", code, machineId, null, projectKey, allowRetry: true, ct);

    /// <summary>消费：COUNT 型扣减 1 次（requestId 幂等）；TIME 型仅校验。重试仅在有 requestId 时启用。</summary>
    public Task<ActivationResult> ConsumeAsync(string code, string machineId, string? requestId = null, string? projectKey = null, CancellationToken ct = default) =>
        CallAsync("/api/license/consume", code, machineId, requestId, projectKey,
            allowRetry: !string.IsNullOrEmpty(requestId) && _options.MaxRetries > 0, ct);

    private async Task<ActivationResult> CallAsync(string path, string code, string machineId, string? requestId, string? projectKey, bool allowRetry, CancellationToken ct)
    {
        var payload = new Dictionary<string, object?>
        {
            ["code"] = code,
            ["machineId"] = machineId,
            ["projectKey"] = string.IsNullOrEmpty(projectKey) ? _options.ProjectKey : projectKey,
        };
        if (!string.IsNullOrEmpty(requestId))
        {
            payload["requestId"] = requestId;
        }

        var body = JsonSerializer.Serialize(payload);
        var totalAttempts = allowRetry && _options.MaxRetries > 0 ? _options.MaxRetries + 1 : 1;

        ActivationClientException? lastError = null;
        for (var attempt = 1; attempt <= totalAttempts; attempt++)
        {
            try
            {
                return await AttemptAsync(path, body, attempt, ct).ConfigureAwait(false);
            }
            catch (ActivationClientException e)
            {
                lastError = e;
                if (attempt < totalAttempts)
                {
                    await Task.Delay(_options.RetryDelayMilliseconds, ct).ConfigureAwait(false);
                }
            }
        }
        throw lastError!;
    }

    private async Task<ActivationResult> AttemptAsync(string path, string body, int attempt, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, _options.BaseUrl.TrimEnd('/') + path)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        foreach (var (name, value) in _options.Headers)
        {
            request.Headers.TryAddWithoutValidation(name, value);
        }

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new ActivationClientException(ActivationErrorKind.Timeout, "request timed out", path, attempt);
        }
        catch (HttpRequestException e)
        {
            throw new ActivationClientException(ActivationErrorKind.NetworkError, e.Message, path, attempt);
        }

        using (response)
        {
            var raw = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

            if (!string.IsNullOrEmpty(_options.ResponseSecret))
            {
                VerifySignature(response, raw, _options.ResponseSecret);
            }

            Dictionary<string, JsonElement>? parsed;
            try
            {
                parsed = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(raw);
            }
            catch (JsonException)
            {
                parsed = null;
            }
            if (parsed is null)
            {
                throw new ActivationClientException(ActivationErrorKind.InvalidResponse, "response is not a JSON object", path, attempt);
            }

            var statusCode = (int)response.StatusCode;
            if (statusCode >= 400 && !parsed.ContainsKey("success"))
            {
                throw new ActivationClientException(ActivationErrorKind.HttpError, $"HTTP {statusCode}", path, attempt);
            }

            return new ActivationResult(parsed);
        }
    }

    private static void VerifySignature(HttpResponseMessage response, string rawBody, string secret)
    {
        var signature = GetHeader(response, SignatureHeader);
        var timestamp = GetHeader(response, TimestampHeader);
        if (string.IsNullOrEmpty(signature) || string.IsNullOrEmpty(timestamp))
        {
            throw new ActivationClientException(ActivationErrorKind.SignatureMissing, "missing signature headers");
        }
        if (!long.TryParse(timestamp, out var ts))
        {
            throw new ActivationClientException(ActivationErrorKind.SignatureInvalid, "invalid signature timestamp");
        }
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (Math.Abs(now - ts) > SignatureMaxAgeMs)
        {
            throw new ActivationClientException(ActivationErrorKind.SignatureExpired, "signature timestamp outside window");
        }
        var expected = HmacSha256Hex(rawBody, secret);
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(signature)))
        {
            throw new ActivationClientException(ActivationErrorKind.SignatureInvalid, "response signature mismatch");
        }
    }

    private static string GetHeader(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values)
            ? string.Join(",", values)
            : response.Content.Headers.TryGetValues(name, out var contentValues)
                ? string.Join(",", contentValues)
                : string.Empty;

    private static string HmacSha256Hex(string data, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var digest = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToHexString(digest).ToLowerInvariant();
    }
}
