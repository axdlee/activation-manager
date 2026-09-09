<?php
declare(strict_types=1);

require __DIR__ . '/src/ActivationManagerClient.php';

$secret = 'test-secret';
$payload = json_encode(['success' => true, 'licenseMode' => 'COUNT', 'license_mode' => 'COUNT', 'remainingCount' => 9, 'valid' => true]);
$sig = hash_hmac('sha256', $payload, $secret);
$ts = (string)round(microtime(true) * 1000);

// 用 curl 的 --resolve 不可行；直接起一个后台 PHP 内置服务来响应
// 简化：用 file_put_contents + php -S router 脚本
$router = <<<'ROUTER'
<?php
$secret = 'test-secret';
$body = file_get_contents('php://input');
$req = json_decode($body, true);
if (!in_array($req['projectKey'] ?? '', ['demo', 'override'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'bad projectKey']);
    exit;
}
$payload = json_encode(['success' => true, 'licenseMode' => 'COUNT', 'license_mode' => 'COUNT', 'remainingCount' => 9, 'valid' => true]);
header('Content-Type: application/json');
header('x-license-signature: ' . hash_hmac('sha256', $payload, $secret));
header('x-license-timestamp: ' . round(microtime(true) * 1000));
echo $payload;
ROUTER;
file_put_contents('/tmp/php-sdk-router.php', $router);

$port = 8931;
$proc = proc_open(PHP_BINARY . " -S 127.0.0.1:$port /tmp/php-sdk-router.php", [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
usleep(300000);

// 1. activate + 验签通过
$client = new ActivationManagerClient(['baseUrl' => "http://127.0.0.1:$port", 'projectKey' => 'demo', 'responseSecret' => $secret]);
$result = $client->activate('CODE-1', 'm-1');
assert($result['success'] === true);
assert($result['licenseMode'] === 'COUNT' || $result['license_mode'] === 'COUNT');
echo "✅ activate + 验签 OK\n";

// 2. projectKey 覆盖
$client->activate('CODE-2', 'm-2', 'override');
echo "（projectKey override 由 router 校验）\n";

// 3. 验签失败（错误密钥）
$bad = new ActivationManagerClient(['baseUrl' => "http://127.0.0.1:$port", 'responseSecret' => 'wrong']);
try {
    $bad->activate('C', 'm');
    echo "❌ 应抛出签名异常\n";
    proc_terminate($proc);
    exit(1);
} catch (ActivationManagerClientError $e) {
    assert(str_starts_with($e->kind, 'SIGNATURE'));
    echo "✅ 签名校验失败正确抛出: {$e->kind}\n";
}

proc_terminate($proc);
echo "✅ PHP SDK 自测通过\n";
