# frozen_string_literal: true

# Activation Manager License API SDK (Ruby)
#
# 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Ruby 单文件实现：
#  - activate / status / consume 三个正式接口（/api/verify 兼容接口不提供）
#  - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
#  - 可选 project_key 默认值，单次调用可覆盖
#  - 超时 / 重试（仅瞬时网络错误；consume 建议配 request_id 保证幂等）
#  - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
#
# 用法：
#
#   client = ActivationManagerClient.new(
#     base_url: 'http://127.0.0.1:3000',
#     project_key: 'browser-plugin',
#     timeout_seconds: 10,
#     max_retries: 1
#   )
#
#   result = client.activate(code: 'A1B2C3D4E5F6G7H8', machine_id: 'machine-001')
#   puts "激活失败: #{result[:message]}" unless result[:success]
#
# 仅依赖 Ruby 3.0+ 标准库（net/http / openssl / json）。

require 'json'
require 'net/http'
require 'openssl'
require 'time'

# 网络异常/超时/签名失败时抛出；业务失败通过 result[:success]=false 判断。
class ActivationManagerClientError < StandardError
  attr_reader :kind, :path, :attempt_count

  def initialize(kind, message, path: '', attempt_count: 1)
    super(message)
    @kind = kind
    @path = path
    @attempt_count = attempt_count
  end
end

class ActivationManagerClient
  SIGNATURE_HEADER = 'x-license-signature'
  TIMESTAMP_HEADER = 'x-license-timestamp'
  SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

  # @param base_url [String]
  # @param project_key [String] 默认 projectKey，单次调用可覆盖
  # @param timeout_seconds [Integer] 单请求超时，默认 10
  # @param max_retries [Integer] 重试次数，默认 0
  # @param retry_delay_seconds [Float] 重试间隔，默认 0.2
  # @param headers [Hash<String,String>] 附加请求头
  # @param response_secret [String] 响应验签密钥（服务端 licenseResponseSecret）
  def initialize(base_url:, project_key: 'default', timeout_seconds: 10, max_retries: 0,
                 retry_delay_seconds: 0.2, headers: {}, response_secret: '')
    @base_url = base_url.chomp('/')
    @project_key = project_key
    @timeout_seconds = timeout_seconds
    @max_retries = max_retries
    @retry_delay_seconds = retry_delay_seconds
    @headers = headers
    @response_secret = response_secret
  end

  # 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。
  def activate(code:, machine_id:, project_key: nil)
    call('/api/license/activate', code, machine_id, nil, project_key, allow_retry: true)
  end

  # 查询状态：剩余次数 / 过期时间 / 是否已绑定。
  def status(code:, machine_id:, project_key: nil)
    call('/api/license/status', code, machine_id, nil, project_key, allow_retry: true)
  end

  # 消费：COUNT 型扣减 1 次（request_id 幂等）；TIME 型仅校验。重试仅在有 request_id 时启用。
  def consume(code:, machine_id:, request_id: nil, project_key: nil)
    call('/api/license/consume', code, machine_id, request_id, project_key,
         allow_retry: !(request_id.nil? || request_id.empty?))
  end

  private

  def call(path, code, machine_id, request_id, project_key, allow_retry:)
    payload = {
      code: code,
      machineId: machine_id,
      projectKey: project_key.nil? || project_key.empty? ? @project_key : project_key
    }
    payload[:requestId] = request_id if request_id && !request_id.empty?

    total_attempts = allow_retry && @max_retries.positive? ? @max_retries + 1 : 1
    last_error = nil

    total_attempts.times do |index|
      attempt = index + 1
      begin
        return attempt_request(path, JSON.generate(payload), attempt)
      rescue ActivationManagerClientError => e
        last_error = e
        sleep @retry_delay_seconds if attempt < total_attempts
      end
    end
    raise last_error
  end

  def attempt_request(path, body, attempt)
    uri = URI("#{@base_url}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == 'https'
    http.read_timeout = @timeout_seconds
    http.open_timeout = @timeout_seconds

    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = 'application/json'
    @headers.each { |k, v| request[k] = v }
    request.body = body

    response = http.start { |h| h.request(request) }
    raw = response.body.to_s

    verify_signature(response, raw) unless @response_secret.empty?

    parsed = JSON.parse(raw)
    unless parsed.is_a?(Hash)
      raise ActivationManagerClientError.new('INVALID_RESPONSE', 'response is not a JSON object', path: path, attempt_count: attempt)
    end

    if response.code.to_i >= 400 && !parsed.key?('success')
      raise ActivationManagerClientError.new('HTTP_ERROR', "HTTP #{response.code}", path: path, attempt_count: attempt)
    end

    parsed
  rescue Net::OpenTimeout, Net::ReadTimeout
    raise ActivationManagerClientError.new('TIMEOUT', 'request timed out', path: path, attempt_count: attempt)
  rescue SocketError, Errno::ECONNREFUSED, IOError => e
    raise ActivationManagerClientError.new('NETWORK_ERROR', e.message, path: path, attempt_count: attempt)
  rescue JSON::ParserError
    raise ActivationManagerClientError.new('INVALID_RESPONSE', 'response is not valid JSON', path: path, attempt_count: attempt)
  end

  def verify_signature(response, raw_body)
    signature = response[SIGNATURE_HEADER].to_s
    timestamp = response[TIMESTAMP_HEADER].to_s
    if signature.empty? || timestamp.empty?
      raise ActivationManagerClientError.new('SIGNATURE_MISSING', 'missing signature headers')
    end
    ts = begin
      Integer(timestamp)
    rescue ArgumentError
      raise ActivationManagerClientError.new('SIGNATURE_INVALID', 'invalid signature timestamp')
    end
    if ((now_ms - ts).abs > SIGNATURE_MAX_AGE_MS)
      raise ActivationManagerClientError.new('SIGNATURE_EXPIRED', 'signature timestamp outside window')
    end
    expected = OpenSSL::HMAC.hexdigest('SHA256', @response_secret, raw_body)
    unless OpenSSL.secure_compare(expected, signature)
      raise ActivationManagerClientError.new('SIGNATURE_INVALID', 'response signature mismatch')
    end
  end

  def now_ms
    (Process.clock_gettime(Process::CLOCK_REALTIME) * 1000).round
  end
end
