// ActivationManager License API SDK (Scala 3 / JVM)
//
// 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Scala 实现：
//  - activate / status / consume 三个正式接口
//  - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
//  - 可选 projectKey 默认值，单次调用可覆盖
//  - 超时 / 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
//  - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
//
// 零第三方依赖（JVM 标准 java.net.http + javax.crypto + 手写轻量 JSON 扁平解析）。
// 用法：
//   val client = ActivationManagerClient(ActivationManagerClient.Options(
//     baseUrl = "http://127.0.0.1:3000", projectKey = "browser-plugin"))
//   val result = client.activate("A1B2C3D4E5F6G7H8", "machine-001")
//   if (!result.success) println(s"激活失败: ${result.message}")

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.net.URI
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.time.Duration
import scala.util.{Try, Success, Failure}

object ActivationManagerClient:
  val SignatureHeader: String = "x-license-signature"
  val TimestampHeader: String = "x-license-timestamp"
  val SignatureMaxAgeMs: Long = 5 * 60 * 1000L

  enum ErrorKind(val code: String):
    case NetworkError extends ErrorKind("NETWORK_ERROR")
    case Timeout extends ErrorKind("TIMEOUT")
    case InvalidResponse extends ErrorKind("INVALID_RESPONSE")
    case HttpError extends ErrorKind("HTTP_ERROR")
    case SignatureMissing extends ErrorKind("SIGNATURE_MISSING")
    case SignatureExpired extends ErrorKind("SIGNATURE_EXPIRED")
    case SignatureInvalid extends ErrorKind("SIGNATURE_INVALID")

  /** 网络异常/超时/签名失败时抛出；业务失败通过 result.success=false 判断。 */
  final case class ClientException(kind: ErrorKind, message: String, path: String = "", attemptCount: Int = 1)
      extends RuntimeException(s"${kind.code}: $message (path=$path, attempt=$attemptCount)")

  /** 服务端响应（双字段归一化取值）。 */
  final case class Result(
      success: Boolean,
      message: Option[String],
      licenseMode: Option[String],
      expiresAt: Option[String],
      remainingCount: Option[Long],
      isActivated: Option[Boolean],
      valid: Option[Boolean],
      idempotent: Option[Boolean],
      rawBody: String,
  )

  final case class Options(
      baseUrl: String = "http://127.0.0.1:3000",
      projectKey: String = "default",
      timeoutSeconds: Long = 10,
      maxRetries: Int = 0,
      retryDelayMs: Long = 200,
      responseSecret: String = "",
  )

  // 极简扁平 JSON 解析（本 SDK 只需一层对象；避免 circle/play-json 依赖）
  private def findString(body: String, camel: String, snake: String): Option[String] =
    findRawString(body, camel).orElse(findRawString(body, snake))

  private def findRawString(body: String, key: String): Option[String] =
    val pattern = "\"" + key + "\""
    val pos = body.indexOf(pattern)
    if pos < 0 then None
    else
      val colon = body.indexOf(':', pos + pattern.length)
      if colon < 0 then None
      else
        var i = colon + 1
        while i < body.length && body(i).isWhitespace do i += 1
        if i >= body.length || body(i) != '"' then None
        else
          i += 1
          val sb = new StringBuilder
          while i < body.length && body(i) != '"' do
            if body(i) == '\\' && i + 1 < body.length then
              i += 1
              body(i) match
                case 'n' => sb.append('\n')
                case 'r' => sb.append('\r')
                case 't' => sb.append('\t')
                case c   => sb.append(c)
            else sb.append(body(i))
            i += 1
          Some(sb.result())

  private def findNumber(body: String, camel: String, snake: String): Option[Long] =
    findNumberRaw(body, camel).orElse(findNumberRaw(body, snake))

  private def findNumberRaw(body: String, key: String): Option[Long] =
    val pattern = "\"" + key + "\""
    val pos = body.indexOf(pattern)
    if pos < 0 then None
    else
      val colon = body.indexOf(':', pos + pattern.length)
      if colon < 0 then None
      else
        var i = colon + 1
        while i < body.length && body(i).isWhitespace do i += 1
        if i >= body.length then None
        else
          var j = i
          if j < body.length && (body(j) == '-' || body(j) == '+') then j += 1
          while j < body.length && body(j).isDigit do j += 1
          if j == i then None else Try(body.substring(i, j).toLong).toOption

  private def findBool(body: String, camel: String, snake: String): Option[Boolean] =
    findBoolRaw(body, camel).orElse(findBoolRaw(body, snake))

  private def findBoolRaw(body: String, key: String): Option[Boolean] =
    val pattern = "\"" + key + "\":"
    val pos = body.indexOf(pattern)
    if pos < 0 then None
    else
      val rest = body.drop(pos + pattern.length).dropWhile(_.isWhitespace)
      if rest.startsWith("true") then Some(true)
      else if rest.startsWith("false") then Some(false)
      else None

final class ActivationManagerClient(options: ActivationManagerClient.Options):
  import ActivationManagerClient.*

  private val http: HttpClient = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(options.timeoutSeconds))
    .build()

  /** 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。 */
  def activate(code: String, machineId: String, projectKey: Option[String] = None): Result =
    call("/api/license/activate", code, machineId, None, projectKey, allowRetry = true)

  /** 查询状态：剩余次数 / 过期时间 / 是否已绑定。 */
  def status(code: String, machineId: String, projectKey: Option[String] = None): Result =
    call("/api/license/status", code, machineId, None, projectKey, allowRetry = true)

  /** 消费：COUNT 型扣减 1 次（requestId 幂等）；TIME 型仅校验。重试仅在有 requestId 时启用。 */
  def consume(code: String, machineId: String, requestId: Option[String] = None, projectKey: Option[String] = None): Result =
    call("/api/license/consume", code, machineId, requestId, projectKey,
      allowRetry = requestId.exists(_.nonEmpty))

  private def call(path: String, code: String, machineId: String,
                   requestId: Option[String], projectKey: Option[String], allowRetry: Boolean): Result =
    val pk = projectKey.filter(_.nonEmpty).getOrElse(options.projectKey)
    val payload = new StringBuilder
    payload.append("{\"code\":\"").append(escape(code))
    payload.append("\",\"machineId\":\"").append(escape(machineId)).append("\"")
    requestId.filter(_.nonEmpty).foreach(rid => payload.append(",\"requestId\":\"").append(escape(rid)).append("\""))
    payload.append(",\"projectKey\":\"").append(escape(pk)).append("\"}")
    val body = payload.result()

    val totalAttempts = if allowRetry && options.maxRetries > 0 then options.maxRetries + 1 else 1
    var lastError: ClientException = ClientException(ErrorKind.NetworkError, "unreachable")

    for attempt <- 1 to totalAttempts do
      attemptOnce(path, body, attempt) match
        case Success(result) => return result
        case Failure(e: ClientException) =>
          lastError = e
          if attempt < totalAttempts then Thread.sleep(options.retryDelayMs)
        case Failure(e) => throw e
    lastError

  private def attemptOnce(path: String, body: String, attempt: Int): Try[Result] =
    val request = HttpRequest.newBuilder()
      .uri(URI.create(options.baseUrl + path))
      .timeout(Duration.ofSeconds(options.timeoutSeconds))
      .header("Content-Type", "application/json")
      .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
      .build()

    Try(http.send(request, HttpResponse.BodyHandlers.ofString())) match
      case Failure(e: java.net.http.HttpTimeoutException) =>
        Failure(ClientException(ErrorKind.Timeout, "request timed out", path, attempt))
      case Failure(e) =>
        Failure(ClientException(ErrorKind.NetworkError, String.valueOf(e), path, attempt))
      case Success(response) =>
        val raw = response.body()
        if options.responseSecret.nonEmpty then
          verifySignature(response.headers(), raw)

        val hasSuccessKey = raw.contains("\"success\"")
        if response.statusCode() >= 400 && !hasSuccessKey then
          Failure(ClientException(ErrorKind.HttpError, s"HTTP ${response.statusCode()}", path, attempt))
        else if !hasSuccessKey then
          Failure(ClientException(ErrorKind.InvalidResponse, "response is not a JSON object", path, attempt))
        else
          Success(Result(
            success = findBoolRaw(raw, "success").getOrElse(false),
            message = findString(raw, "message", "message"),
            licenseMode = findString(raw, "licenseMode", "license_mode"),
            expiresAt = findString(raw, "expiresAt", "expires_at"),
            remainingCount = findNumber(raw, "remainingCount", "remaining_count"),
            isActivated = findBool(raw, "isActivated", "is_activated"),
            valid = findBoolRaw(raw, "valid"),
            idempotent = findBoolRaw(raw, "idempotent"),
            rawBody = raw,
          ))

  private def verifySignature(headers: java.net.http.HttpHeaders, rawBody: String): Unit =
    val signature = headers.firstValue(SignatureHeader).orElse("")
    val timestamp = headers.firstValue(TimestampHeader).orElse("")
    if signature.isEmpty || timestamp.isEmpty then
      throw ClientException(ErrorKind.SignatureMissing, "missing signature headers")
    val ts = timestamp.toLongOption.getOrElse(throw ClientException(ErrorKind.SignatureInvalid, "invalid signature timestamp"))
    val now = System.currentTimeMillis()
    if math.abs(now - ts) > SignatureMaxAgeMs then
      throw ClientException(ErrorKind.SignatureExpired, "signature timestamp outside window")
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(new SecretKeySpec(options.responseSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
    val expected = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8)).map("%02x".format(_)).mkString
    if !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8)) then
      throw ClientException(ErrorKind.SignatureInvalid, "response signature mismatch")

  private def escape(s: String): String =
    s.replace("\\", "\\\\").replace("\"", "\\\"")

  private def IOException = new Exception() match
    case _ => classOf[java.io.IOException]
