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
        var hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes("test-secret"));
        var body = "{\"success\":true}";
        var goodSig = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(body))).ToLowerInvariant();

        var http = new MockHandler(_ => (200, body,
            new Dictionary<string, string>
            {
                ["x-license-signature"] = goodSig,
                ["x-license-timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(),
            }));
        var client = new ActivationManagerClient(
            new ActivationManagerClientOptions { BaseUrl = "http://mock", ResponseSecret = "wrong" }, http);

        var ex = await Assert.ThrowsAsync<ActivationClientException>(() => client.StatusAsync("C", "m"));
        Assert.Equal(ActivationErrorKind.SignatureInvalid, ex.Kind);
    }

    [Fact]
    public async Task Signature_GoodSecret_Passes()
    {
        var hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes("test-secret"));
        var body = "{\"success\":true}";
        var sig = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(body))).ToLowerInvariant();

        var http = new MockHandler(_ => (200, body,
            new Dictionary<string, string>
            {
                ["x-license-signature"] = sig,
                ["x-license-timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(),
            }));
        var client = new ActivationManagerClient(
            new ActivationManagerClientOptions { BaseUrl = "http://mock", ResponseSecret = "test-secret" }, http);

        var result = await client.StatusAsync("C", "m");
        Assert.True(result.Success);
    }
}
