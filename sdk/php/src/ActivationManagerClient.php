<?php
/**
 * Activation Manager License API SDK (PHP)
 *
 * 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 PHP 单文件实现：
 *  - activate / status / consume 三个正式接口（/api/verify 兼容接口不提供）
 *  - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
 *  - 可选 projectKey 默认值，单次调用可覆盖
 *  - 超时 / 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
 *  - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
 *
 * 用法：
 *
 *   $client = new ActivationManagerClient([
 *       'baseUrl'    => 'http://127.0.0.1:3000',
 *       'projectKey' => 'browser-plugin',
 *       'timeoutMs'  => 10000,
 *       'maxRetries' => 1,
 *   ]);
 *
 *   $result = $client->activate('A1B2C3D4E5F6G7H8', 'machine-001');
 *   if (!$result['success']) {
 *       echo '激活失败: ', $result['message'];
 *   }
 *
 * 仅依赖 PHP 7.4+ 标准库（curl / hash / json）。
 */

declare(strict_types=1);

final class ActivationManagerClientError extends RuntimeException
{
    public string $kind;
    public string $path;
    public int $attemptCount;

    public function __construct(string $kind, string $message, string $path = '', int $attemptCount = 1)
    {
        parent::__construct($message);
        $this->kind = $kind;
        $this->path = $path;
        $this->attemptCount = $attemptCount;
    }
}

final class ActivationManagerClient
{
    public const SIGNATURE_HEADER = 'x-license-signature';
    public const TIMESTAMP_HEADER = 'x-license-timestamp';
    public const SIGNATURE_MAX_AGE_MS = 300000; // 5 分钟

    private string $baseUrl;
    private string $projectKey;
    private int $timeoutMs;
    private int $maxRetries;
    private int $retryDelayMs;
    /** @var array<string,string> */
    private array $headers;
    private string $responseSecret;

    /** @param array<string,mixed> $options baseUrl/projectKey/timeoutMs/maxRetries/retryDelayMs/headers/responseSecret */
    public function __construct(array $options = [])
    {
        $this->baseUrl = rtrim((string)($options['baseUrl'] ?? 'http://127.0.0.1:3000'), '/');
        $this->projectKey = (string)($options['projectKey'] ?? 'default');
        $this->timeoutMs = max(1, (int)($options['timeoutMs'] ?? 10000));
        $this->maxRetries = max(0, (int)($options['maxRetries'] ?? 0));
        $this->retryDelayMs = max(0, (int)($options['retryDelayMs'] ?? 200));
        $this->headers = (array)($options['headers'] ?? []);
        $this->responseSecret = (string)($options['responseSecret'] ?? '');
    }

    /** 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。 */
    public function activate(string $code, string $machineId, ?string $projectKey = null): array
    {
        return $this->call('/api/license/activate', $code, $machineId, null, $projectKey, true);
    }

    /** 查询状态：剩余次数 / 过期时间 / 是否已绑定。 */
    public function status(string $code, string $machineId, ?string $projectKey = null): array
    {
        return $this->call('/api/license/status', $code, $machineId, null, $projectKey, true);
    }

    /** 消费：COUNT 型扣减 1 次（requestId 幂等）；TIME 型仅校验。重试仅在有 requestId 时启用。 */
    public function consume(string $code, string $machineId, ?string $requestId = null, ?string $projectKey = null): array
    {
        return $this->call('/api/license/consume', $code, $machineId, $requestId, $projectKey, $requestId !== null && $requestId !== '');
    }

    private function call(string $path, string $code, string $machineId, ?string $requestId, ?string $projectKey, bool $allowRetry): array
    {
        $payload = [
            'code' => $code,
            'machineId' => $machineId,
            'projectKey' => $projectKey !== null && $projectKey !== '' ? $projectKey : $this->projectKey,
        ];
        if ($requestId !== null && $requestId !== '') {
            $payload['requestId'] = $requestId;
        }

        $totalAttempts = $allowRetry && $this->maxRetries > 0 ? $this->maxRetries + 1 : 1;
        $lastError = null;

        for ($attempt = 1; $attempt <= $totalAttempts; $attempt++) {
            try {
                return $this->attempt($path, $payload, $attempt);
            } catch (ActivationManagerClientError $error) {
                $lastError = $error;
                if ($attempt < $totalAttempts) {
                    usleep($this->retryDelayMs * 1000);
                }
            }
        }
        throw $lastError;
    }

    private function attempt(string $path, array $payload, int $attempt): array
    {
        $url = $this->baseUrl . $path;
        $handle = curl_init($url);
        if ($handle === false) {
            throw new ActivationManagerClientError('NETWORK_ERROR', 'curl init failed', $path, $attempt);
        }

        $headers = ['Content-Type: application/json'];
        foreach ($this->headers as $name => $value) {
            $headers[] = $name . ': ' . $value;
        }

        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_TIMEOUT_MS => $this->timeoutMs,
            CURLOPT_HTTPHEADER => $headers,
        ]);

        $raw = curl_exec($handle);
        if ($raw === false) {
            $errno = curl_errno($handle);
            $kind = $errno === CURLE_OPERATION_TIMEDOUT ? 'TIMEOUT' : 'NETWORK_ERROR';
            $message = curl_error($handle);
            throw new ActivationManagerClientError($kind, $message ?: 'request failed', $path, $attempt);
        }

        $statusCode = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        [$headerText, $bodyText] = $this->splitResponse($raw);

        if ($this->responseSecret !== '') {
            $this->verifySignature($headerText, $bodyText);
        }

        $parsed = json_decode($bodyText, true);
        if (!is_array($parsed)) {
            throw new ActivationManagerClientError('INVALID_RESPONSE', 'response is not a JSON object', $path, $attempt);
        }

        if ($statusCode >= 400 && !array_key_exists('success', $parsed)) {
            throw new ActivationManagerClientError('HTTP_ERROR', 'HTTP ' . $statusCode, $path, $attempt);
        }

        return $parsed;
    }

    /** @return array{0:string,1:string} [headers, body] */
    private function splitResponse(string $raw): array
    {
        $offset = strpos($raw, "\r\n\r\n");
        if ($offset === false) {
            return ['', $raw];
        }
        return [substr($raw, 0, $offset), substr($raw, $offset + 4)];
    }

    private function verifySignature(string $headerText, string $body): void
    {
        $signature = '';
        $timestamp = '';
        foreach (explode("\r\n", $headerText) as $line) {
            [$name, $value] = array_pad(explode(':', $line, 2), 2, '');
            $lower = strtolower(trim($name));
            if ($lower === self::SIGNATURE_HEADER) {
                $signature = trim($value);
            } elseif ($lower === self::TIMESTAMP_HEADER) {
                $timestamp = trim($value);
            }
        }
        if ($signature === '' || $timestamp === '') {
            throw new ActivationManagerClientError('SIGNATURE_MISSING', 'missing signature headers');
        }
        if (!ctype_digit($timestamp)) {
            throw new ActivationManagerClientError('SIGNATURE_INVALID', 'invalid signature timestamp');
        }
        if (abs($this->nowMs() - (int)$timestamp) > self::SIGNATURE_MAX_AGE_MS) {
            throw new ActivationManagerClientError('SIGNATURE_EXPIRED', 'signature timestamp outside window');
        }
        $expected = hash_hmac('sha256', $body, $this->responseSecret);
        if (!hash_equals($expected, $signature)) {
            throw new ActivationManagerClientError('SIGNATURE_INVALID', 'response signature mismatch');
        }
    }

    private function nowMs(): int
    {
        return (int)round(microtime(true) * 1000);
    }
}
