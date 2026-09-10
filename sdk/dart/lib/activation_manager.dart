// ActivationManager License API SDK (Dart 3+)
//
// 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Dart 实现：
//  - activate / status / consume 三个正式接口
//  - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
//  - 可选 projectKey 默认值，单次调用可覆盖
//  - 超时 / 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
//  - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗，package:crypto）
//
// 用法：
//   final client = ActivationManagerClient(
//     baseUrl: 'http://127.0.0.1:3000', projectKey: 'browser-plugin');
//   final result = await client.activate('A1B2C3D4E5F6G7H8', 'machine-001');
//   if (!result.success) print('激活失败: ${result.message}');

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;

const String signatureHeader = 'x-license-signature';
const String timestampHeader = 'x-license-timestamp';
const int signatureMaxAgeMs = 5 * 60 * 1000;

/// 错误分类，与 JS/Python/Go SDK 对齐。
enum ActivationErrorKind {
  networkError,
  timeout,
  invalidResponse,
  httpError,
  signatureMissing,
  signatureExpired,
  signatureInvalid,
}

/// 网络异常/超时/签名失败时抛出；业务失败通过 result.success=false 判断。
class ActivationClientException implements Exception {
  final ActivationErrorKind kind;
  final String message;
  final String path;
  final int attemptCount;

  ActivationClientException(this.kind, this.message,
      {this.path = '', this.attemptCount = 1});

  String get kindCode {
    switch (kind) {
      case ActivationErrorKind.networkError:
        return 'NETWORK_ERROR';
      case ActivationErrorKind.timeout:
        return 'TIMEOUT';
      case ActivationErrorKind.invalidResponse:
        return 'INVALID_RESPONSE';
      case ActivationErrorKind.httpError:
        return 'HTTP_ERROR';
      case ActivationErrorKind.signatureMissing:
        return 'SIGNATURE_MISSING';
      case ActivationErrorKind.signatureExpired:
        return 'SIGNATURE_EXPIRED';
      case ActivationErrorKind.signatureInvalid:
        return 'SIGNATURE_INVALID';
    }
  }

  @override
  String toString() => '$kindCode: $message (path=$path, attempt=$attemptCount)';
}

/// 服务端响应（双字段归一化取值）。
class ActivationResult {
  final bool success;
  final String? message;
  final String? licenseMode;
  final String? expiresAt;
  final int? remainingCount;
  final bool? isActivated;
  final bool? valid;
  final bool? idempotent;
  final String rawBody;

  ActivationResult({
    required this.success,
    this.message,
    this.licenseMode,
    this.expiresAt,
    this.remainingCount,
    this.isActivated,
    this.valid,
    this.idempotent,
    required this.rawBody,
  });

  /// camelCase 优先，回退 snake_case。
  static String? pick(
      Map<String, dynamic> raw, String camel, String snake, bool Function(Object?) test) {
    final a = raw[camel];
    final b = raw[snake];
    if (test(a)) return a as String?;
    if (test(b)) return b as String?;
    return null;
  }

  static ActivationResult parse(String body) {
    final raw = jsonDecode(body) as Map<String, dynamic>;
    final strOk = (Object? v) => v is String;
    return ActivationResult(
      success: raw['success'] == true,
      message: raw['message'] as String?,
      licenseMode: pick(raw, 'licenseMode', 'license_mode', strOk),
      expiresAt: pick(raw, 'expiresAt', 'expires_at', strOk),
      remainingCount: (raw['remainingCount'] as num?)?.toInt() ??
          (raw['remaining_count'] as num?)?.toInt(),
      isActivated: raw['isActivated'] as bool? ?? raw['is_activated'] as bool?,
      valid: raw['valid'] as bool?,
      idempotent: raw['idempotent'] as bool?,
      rawBody: body,
    );
  }
}

/// 客户端配置。
class ActivationManagerOptions {
  final String baseUrl;
  final String projectKey;
  final Duration timeout;
  final int maxRetries;
  final Duration retryDelay;
  final Map<String, String> headers;
  final String responseSecret;

  const ActivationManagerOptions({
    this.baseUrl = 'http://127.0.0.1:3000',
    this.projectKey = 'default',
    this.timeout = const Duration(seconds: 10),
    this.maxRetries = 0,
    this.retryDelay = const Duration(milliseconds: 200),
    this.headers = const {},
    this.responseSecret = '',
  });
}

class ActivationManagerClient {
  final ActivationManagerOptions options;
  final http.Client _http;

  ActivationManagerClient({
    required String baseUrl,
    String projectKey = 'default',
    Duration timeout = const Duration(seconds: 10),
    int maxRetries = 0,
    Duration retryDelay = const Duration(milliseconds: 200),
    Map<String, String> headers = const {},
    String responseSecret = '',
    http.Client? httpClient,
  })  : options = ActivationManagerOptions(
          baseUrl: baseUrl,
          projectKey: projectKey,
          timeout: timeout,
          maxRetries: maxRetries,
          retryDelay: retryDelay,
          headers: headers,
          responseSecret: responseSecret,
        ),
        _http = httpClient ?? http.Client();

  /// 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。
  Future<ActivationResult> activate(String code, String machineId,
          {String? projectKey}) =>
      _call('/api/license/activate', code, machineId, null, projectKey, allowRetry: true);

  /// 查询状态：剩余次数 / 过期时间 / 是否已绑定。
  Future<ActivationResult> status(String code, String machineId,
          {String? projectKey}) =>
      _call('/api/license/status', code, machineId, null, projectKey, allowRetry: true);

  /// 消费：COUNT 型扣减 1 次（requestId 幂等）；TIME 型仅校验。
  /// 重试仅在传了 requestId 时启用（防重复扣次）。
  Future<ActivationResult> consume(String code, String machineId,
          {String? requestId, String? projectKey}) =>
      _call('/api/license/consume', code, machineId, requestId, projectKey,
          allowRetry: !(requestId ?? '').isEmpty);

  Future<ActivationResult> _call(String path, String code, String machineId,
      String? requestId, String? projectKey,
      {required bool allowRetry}) async {
    final payload = <String, dynamic>{
      'code': code,
      'machineId': machineId,
      'projectKey': (projectKey?.isNotEmpty ?? false) ? projectKey : options.projectKey,
    };
    if (requestId != null && requestId.isNotEmpty) {
      payload['requestId'] = requestId;
    }

    final totalAttempts =
        (allowRetry && options.maxRetries > 0) ? options.maxRetries + 1 : 1;

    Object? lastError;
    for (var attempt = 1; attempt <= totalAttempts; attempt++) {
      try {
        return await _attemptOnce(path, payload, attempt);
      } on ActivationClientException catch (e) {
        lastError = e;
        if (attempt < totalAttempts) {
          await Future<void>.delayed(options.retryDelay);
        }
      }
    }
    throw lastError!;
  }

  Future<ActivationResult> _attemptOnce(
      String path, Map<String, dynamic> payload, int attempt) async {
    final url = Uri.parse('${options.baseUrl}${path}');
    final body = jsonEncode(payload);

    http.Response response;
    try {
      response = await _http
          .post(url,
              headers: {'Content-Type': 'application/json', ...options.headers},
              body: body)
          .timeout(options.timeout);
    } on TimeoutException {
      throw ActivationClientException(ActivationErrorKind.timeout,
          'request timed out',
          path: path, attemptCount: attempt);
    } catch (e) {
      throw ActivationClientException(ActivationErrorKind.networkError, '$e',
          path: path, attemptCount: attempt);
    }

    final raw = response.body;
    if (options.responseSecret.isNotEmpty) {
      _verifySignature(response.headers, raw);
    }

    ActivationResult result;
    try {
      result = ActivationResult.parse(raw);
    } catch (_) {
      throw ActivationClientException(ActivationErrorKind.invalidResponse,
          'response is not a JSON object',
          path: path, attemptCount: attempt);
    }

    if (response.statusCode >= 400 && !raw.contains('"success"')) {
      throw ActivationClientException(ActivationErrorKind.httpError,
          'HTTP ${response.statusCode}',
          path: path, attemptCount: attempt);
    }
    return result;
  }

  void _verifySignature(Map<String, String> headers, String rawBody) {
    String? get(String name) {
      for (final entry in headers.entries) {
        if (entry.key.toLowerCase() == name) return entry.value;
      }
      return null;
    }

    final signature = get(signatureHeader) ?? '';
    final timestamp = get(timestampHeader) ?? '';
    if (signature.isEmpty || timestamp.isEmpty) {
      throw ActivationClientException(ActivationErrorKind.signatureMissing,
          'missing signature headers');
    }
    final ts = int.tryParse(timestamp);
    if (ts == null) {
      throw ActivationClientException(ActivationErrorKind.signatureInvalid,
          'invalid signature timestamp');
    }
    final now = DateTime.now().millisecondsSinceEpoch;
    if ((now - ts).abs() > signatureMaxAgeMs) {
      throw ActivationClientException(ActivationErrorKind.signatureExpired,
          'signature timestamp outside window');
    }
    final expected = Hmac(sha256, utf8.encode(options.responseSecret))
        .convert(utf8.encode(rawBody))
        .toString();
    if (!_fixedTimeEquals(expected, signature)) {
      throw ActivationClientException(ActivationErrorKind.signatureInvalid,
          'response signature mismatch');
    }
  }

  static bool _fixedTimeEquals(String a, String b) {
    if (a.length != b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return diff == 0;
  }
}
