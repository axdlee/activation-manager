// Package activationmanager — Activation Manager License API SDK (Go)
//
// 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Go 单文件实现：
//   - activate / status / consume 三个正式接口（/api/verify 兼容接口不提供）
//   - 统一 camelCase 请求；响应保留服务端双字段（camelCase/snake_case 一致）
//   - 可选 ProjectKey 默认值，单次调用可覆盖
//   - 超时 / 重试（仅瞬时网络错误；consume 建议配 RequestID 保证幂等）
//   - 可选响应验签（服务端配置 licenseResponseSecret 后开启，HMAC-SHA256 + 5 分钟时间窗）
//
// 用法：
//
//	client := activationmanager.NewClient(activationmanager.ClientOptions{
//	    BaseURL:    "http://127.0.0.1:3000",
//	    ProjectKey: "browser-plugin",
//	    Timeout:    10 * time.Second,
//	    MaxRetries: 1,
//	})
//
//	result, err := client.Activate(ctx, "A1B2C3D4E5F6G7H8", "machine-001", nil)
//	if err != nil { ... }
//	if !result.Success { fmt.Println("激活失败:", result.Message) }
//
// 仅依赖标准库（net/http / crypto/hmac / encoding/json）。
package activationmanager

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"time"
)

const (
	SignatureHeader     = "x-license-signature"
	TimestampHeader     = "x-license-timestamp"
	SignatureMaxAgeMS   = int64(5 * 60 * 1000)
	defaultTimeout      = 10 * time.Second
	defaultMaxRetries   = 0
	defaultRetryDelayMS = 200
)

// ErrorKind 与 JS/Python SDK 的错误分类对齐。
type ErrorKind string

const (
	ErrNetworkError    ErrorKind = "NETWORK_ERROR"
	ErrTimeout         ErrorKind = "TIMEOUT"
	ErrInvalidResponse ErrorKind = "INVALID_RESPONSE"
	ErrHTTPError       ErrorKind = "HTTP_ERROR"
	ErrSignature       ErrorKind = "SIGNATURE_INVALID"
	ErrSignatureMiss   ErrorKind = "SIGNATURE_MISSING"
	ErrSignatureExpire ErrorKind = "SIGNATURE_EXPIRED"
)

// ClientError 网络异常/超时/响应不可解析时返回；业务失败通过 Result.Success=false 判断。
type ClientError struct {
	Kind         ErrorKind
	Message      string
	Path         string
	AttemptCount int
}

func (e *ClientError) Error() string {
	return fmt.Sprintf("%s: %s (path=%s, attempt=%d)", e.Kind, e.Message, e.Path, e.AttemptCount)
}

// Result 服务端响应（已双字段归一化，camelCase/snake_case 取值一致）。
type Result struct {
	Success        bool    `json:"success"`
	Message        string  `json:"message"`
	LicenseMode    string  `json:"licenseMode"`
	LicenseModeAlt string  `json:"license_mode"`
	ExpiresAt      *string `json:"expiresAt"`
	ExpiresAtAlt   *string `json:"expires_at"`
	RemainingCount *int64  `json:"remainingCount"`
	RemainingAlt   *int64  `json:"remaining_count"`
	IsActivated    *bool   `json:"isActivated"`
	IsActivatedAlt *bool   `json:"is_activated"`
	Valid          *bool   `json:"valid"`
	Idempotent     *bool   `json:"idempotent"`
}

// 有效值辅助方法：优先取 camelCase 字段。

func (r *Result) EffectiveLicenseMode() string {
	if r.LicenseMode != "" {
		return r.LicenseMode
	}
	return r.LicenseModeAlt
}

func (r *Result) EffectiveExpiresAt() *string {
	if r.ExpiresAt != nil {
		return r.ExpiresAt
	}
	return r.ExpiresAtAlt
}

func (r *Result) EffectiveRemainingCount() *int64 {
	if r.RemainingCount != nil {
		return r.RemainingCount
	}
	return r.RemainingAlt
}

func (r *Result) EffectiveIsActivated() *bool {
	if r.IsActivated != nil {
		return r.IsActivated
	}
	return r.IsActivatedAlt
}

// ClientOptions 客户端配置。
type ClientOptions struct {
	BaseURL        string        // 必填，如 http://127.0.0.1:3000
	ProjectKey     string        // 默认 projectKey，单次调用可覆盖
	Timeout        time.Duration // 单请求超时，默认 10s
	MaxRetries     int           // 重试次数，默认 0（consume 仅传 RequestID 时允许重试）
	RetryDelayMS   int           // 重试间隔毫秒，默认 200
	Headers        map[string]string
	ResponseSecret string                     // 响应验签密钥（服务端 licenseResponseSecret）
	HTTPClient     *http.Client               // 自定义 HTTP 客户端（可选）
	OnRetry        func(attempt int, err error) // 重试回调（可选）
}

// Client License API 客户端。
type Client struct {
	opts ClientOptions
	http *http.Client
}

// NewClient 创建客户端。
func NewClient(opts ClientOptions) *Client {
	if opts.Timeout <= 0 {
		opts.Timeout = defaultTimeout
	}
	if opts.RetryDelayMS <= 0 {
		opts.RetryDelayMS = defaultRetryDelayMS
	}
	httpClient := opts.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: opts.Timeout}
	}
	return &Client{opts: opts, http: httpClient}
}

type callInput struct {
	Code       string  `json:"code"`
	MachineID  string  `json:"machineId"`
	RequestID  *string `json:"requestId,omitempty"`
	ProjectKey string  `json:"projectKey"`
}

type callOverrides struct {
	projectKey string
	requestID  string
}

// Activate 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。
func (c *Client) Activate(ctx context.Context, code, machineID string, projectKey *string) (*Result, error) {
	return c.call(ctx, "/api/license/activate", code, machineID, callOverrides{projectKey: deref(projectKey)}, true)
}

// Status 查询状态：剩余次数 / 过期时间 / 是否已绑定。
func (c *Client) Status(ctx context.Context, code, machineID string, projectKey *string) (*Result, error) {
	return c.call(ctx, "/api/license/status", code, machineID, callOverrides{projectKey: deref(projectKey)}, true)
}

// Consume 消费：COUNT 型扣减 1 次（requestID 幂等）；TIME 型仅校验有效性。
// 自动重试仅在传了 requestID 时生效（防重复扣次，与 JS SDK 约定一致）。
func (c *Client) Consume(ctx context.Context, code, machineID string, requestID, projectKey *string) (*Result, error) {
	return c.call(ctx, "/api/license/consume", code, machineID, callOverrides{projectKey: deref(projectKey), requestID: deref(requestID)}, requestID != nil && *requestID != "")
}

func (c *Client) call(ctx context.Context, path, code, machineID string, ov callOverrides, allowRetry bool) (*Result, error) {
	projectKey := ov.projectKey
	if projectKey == "" {
		projectKey = c.opts.ProjectKey
	}
	if projectKey == "" {
		projectKey = "default"
	}
	input := callInput{Code: code, MachineID: machineID, ProjectKey: projectKey}
	if ov.requestID != "" {
		input.RequestID = &ov.requestID
	}

	body, err := json.Marshal(input)
	if err != nil {
		return nil, &ClientError{Kind: ErrInvalidResponse, Message: err.Error(), Path: path, AttemptCount: 1}
	}

	totalAttempts := 1
	if allowRetry && c.opts.MaxRetries > 0 {
		totalAttempts = c.opts.MaxRetries + 1
	}

	var lastErr *ClientError
	for attempt := 1; attempt <= totalAttempts; attempt++ {
		result, callErr := c.attempt(ctx, path, body, attempt)
		if callErr == nil {
			return result, nil
		}
		lastErr = callErr
		// 业务失败透传（HTTP 层拿到 JSON body）不重试
		if callErr.Kind == ErrInvalidResponse && callErr.Message == "business-response" {
			return result, nil
		}
		if attempt < totalAttempts {
			if c.opts.OnRetry != nil {
				c.opts.OnRetry(attempt, callErr)
			}
			select {
			case <-ctx.Done():
				return nil, &ClientError{Kind: ErrNetworkError, Message: ctx.Err().Error(), Path: path, AttemptCount: attempt}
			case <-time.After(time.Duration(c.opts.RetryDelayMS) * time.Millisecond):
			}
		}
	}
	return nil, lastErr
}

func (c *Client) attempt(ctx context.Context, path string, body []byte, attempt int) (*Result, *ClientError) {
	url := c.opts.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, &ClientError{Kind: ErrNetworkError, Message: err.Error(), Path: path, AttemptCount: attempt}
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range c.opts.Headers {
		req.Header.Set(k, v)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(context.Cause(ctx), context.DeadlineExceeded) || isTimeoutError(err) {
			return nil, &ClientError{Kind: ErrTimeout, Message: "request timed out", Path: path, AttemptCount: attempt}
		}
		return nil, &ClientError{Kind: ErrNetworkError, Message: err.Error(), Path: path, AttemptCount: attempt}
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, &ClientError{Kind: ErrNetworkError, Message: err.Error(), Path: path, AttemptCount: attempt}
	}

	if c.opts.ResponseSecret != "" {
		if vErr := verifySignature(resp.Header, string(raw), c.opts.ResponseSecret); vErr != nil {
			return nil, vErr
		}
	}

	var result Result
	if uErr := json.Unmarshal(raw, &result); uErr != nil {
		return nil, &ClientError{Kind: ErrInvalidResponse, Message: "response is not valid JSON object", Path: path, AttemptCount: attempt}
	}

	// 服务端业务失败可能以非 200 返回（带 JSON body）——透传
	if resp.StatusCode >= 400 && !result.HasSuccessField() {
		return nil, &ClientError{Kind: ErrHTTPError, Message: fmt.Sprintf("HTTP %d", resp.StatusCode), Path: path, AttemptCount: attempt}
	}
	return &result, nil
}

// HasSuccessField 判断响应体是否为业务响应（含 success 字段）。
func (r *Result) HasSuccessField() bool {
	// json.Unmarshal 无法区分缺失与 false；Success=false 且无任何附加字段视为业务响应
	return true
}

func verifySignature(headers http.Header, rawBody, secret string) *ClientError {
	signature := headers.Get(SignatureHeader)
	timestamp := headers.Get(TimestampHeader)
	if signature == "" || timestamp == "" {
		return &ClientError{Kind: ErrSignatureMiss, Message: "missing signature headers"}
	}
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return &ClientError{Kind: ErrSignature, Message: "invalid signature timestamp"}
	}
	now := time.Now().UnixMilli()
	if math.Abs(float64(now-ts)) > float64(SignatureMaxAgeMS) {
		return &ClientError{Kind: ErrSignatureExpire, Message: "signature timestamp outside window"}
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(rawBody))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return &ClientError{Kind: ErrSignature, Message: "response signature mismatch"}
	}
	return nil
}

// isTimeoutError 识别 http.Client.Timeout 与 context 超时包装的错误。
func isTimeoutError(err error) bool {
	var ne interface{ Timeout() bool }
	if errors.As(err, &ne) {
		return ne.Timeout()
	}
	return false
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
