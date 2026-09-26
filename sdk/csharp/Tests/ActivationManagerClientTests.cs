using ActivationManager.Sdk;
using Xunit;
using System.Net;
using System.Text;

namespace ActivationManager.Sdk.Tests;

public class ActivationManagerClientTests
{
    private sealed class MockHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, (int Status, string Body, Dictionary<string, string>? Headers)> _responder;
        public int Calls;

        public MockHandler(Func<HttpRequestMessage, (int, string, Dictionary<string, string>?)> responder)
        {
            _responder = responder;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref Calls);
            var (status, body, headers) = _responder(request);
            var response = new HttpResponseMessage((HttpStatusCode)status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            };
            if (headers is not null)
            {
                foreach (var (k, v) in headers) response.Headers.TryAddWithoutValidation(k, v);
            }
            return Task.FromResult(response);
        }
    }

    [Fact]
    public async Task Activate_Success_ParsesDualFields()
    {
        var http = new MockHandler(_ => (200,
            "{\"success\":true,\"licenseMode\":\"COUNT\",\"license_mode\":\"COUNT\",\"remainingCount\":9,\"valid\":true}", null));
        var client = new ActivationManagerClient(new ActivationManagerClientOptions { BaseUrl = "http://mock" }, http);

        var result = await client.ActivateAsync("CODE-1", "m-1");
        Assert.True(result.Success);
        Assert.Equal("COUNT", result.LicenseMode);
        Assert.Equal(9, result.RemainingCount);
    }

    [Fact]
    public async Task BusinessFailure_PassesThrough()
    {
        var http = new MockHandler(_ => (200, "{\"success\":false,\"message\":\"激活码不存在\"}", null));
        var client = new ActivationManagerClient(new ActivationManagerClientOptions { BaseUrl = "http://mock" }, http);

        var result = await client.StatusAsync("BAD", "m-1");
        Assert.False(result.Success);
        Assert.Equal("激活码不存在", result.Message);
    }

    [Fact]
    public async Task Consume_NoRequestId_DoesNotRetry()
    {
        var http = new MockHandler(_ => (500, "", null));
        var client = new ActivationManagerClient(
            new ActivationManagerClientOptions { BaseUrl = "http://mock", MaxRetries = 3 }, http);

        await Assert.ThrowsAsync<ActivationClientException>(() => client.ConsumeAsync("C", "m"));
        Assert.Equal(1, http.Calls);
    }

    [Fact]
    public async Task Consume_WithRequestId_Retries()
    {
        var calls = 0;
        var handler = new MockHandler(_ => ++calls == 1
            ? (500, "", null)
            : (200, "{\"success\":true,\"remainingCount\":8}", null));
        var client = new ActivationManagerClient(
            new ActivationManagerClientOptions { BaseUrl = "http://mock", MaxRetries = 3 }, handler);

        var result = await client.ConsumeAsync("C", "m", "req-1");
        Assert.Equal(2, calls);
        Assert.True(result.Success);
    }

    [Fact]
    public async Task Signature_BadSecret_Rejected()
    {
        // 与 JS/Python 相同语义：正确密钥 HMAC 失败 → SignatureInvalid
        var http = new MockHandler(request =>
        {
            var responseBody = "{\"success\":true}";
            var (sig, ts) = SignV4(request, responseBody, "test-secret");
            return (200, responseBody, new Dictionary<string, string>
            {
                ["x-license-signature"] = sig,
                ["x-license-timestamp"] = ts,
                ["x-license-signature-version"] = "4",
            });
        });
        var client = new ActivationManagerClient(
            new ActivationManagerClientOptions { BaseUrl = "http://mock", ResponseSecret = "wrong" }, http);

        var ex = await Assert.ThrowsAsync<ActivationClientException>(() => client.StatusAsync("C", "m"));
        Assert.Equal(ActivationErrorKind.SignatureInvalid, ex.Kind);
    }

    [Fact]
    public async Task Signature_GoodSecret_Passes()
    {
        var http = new MockHandler(request =>
        {
            var responseBody = "{\"success\":true}";
            var (sig, ts) = SignV4(request, responseBody, "test-secret");
            return (200, responseBody, new Dictionary<string, string>
            {
                ["x-license-signature"] = sig,
                ["x-license-timestamp"] = ts,
                ["x-license-signature-version"] = "4",
            });
        });
        var client = new ActivationManagerClient(
            new ActivationManagerClientOptions { BaseUrl = "http://mock", ResponseSecret = "test-secret" }, http);

        var result = await client.StatusAsync("C", "m");
        Assert.True(result.Success);
    }

    /// <summary>
    /// v4 签名桩：上下文（code|machineId|requestId，三段 trim）取自请求体，
    /// body 段为响应体——与服务端签名语义一致。
    /// </summary>
    private static (string Sig, string Ts) SignV4(HttpRequestMessage request, string responseBody, string secret)
    {
        var requestJson = request.Content != null
            ? request.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            : "";
        string code = "", machineId = "", requestId = "";
        using (var doc = System.Text.Json.JsonDocument.Parse(requestJson))
        {
            if (doc.RootElement.TryGetProperty("code", out var c)) code = c.GetString() ?? "";
            if (doc.RootElement.TryGetProperty("machineId", out var m)) machineId = m.GetString() ?? "";
            if (doc.RootElement.TryGetProperty("requestId", out var r)) requestId = r.GetString() ?? "";
        }
        var context = $"{code.Trim()}|{machineId.Trim()}|{requestId.Trim()}";
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        using var hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var sig = Convert.ToHexString(
            hmac.ComputeHash(Encoding.UTF8.GetBytes($"{ts}.{context}.{responseBody}"))).ToLowerInvariant();
        return (sig, ts);
    }
}
