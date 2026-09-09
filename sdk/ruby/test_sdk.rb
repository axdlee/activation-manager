# frozen_string_literal: true

require_relative 'activation_manager_client'
require 'socket'
require 'thread'

$secret = 'test-secret'
$received = []

server = TCPServer.new('127.0.0.1', 0)
$port = server.addr[1]

handler = Thread.new do
  loop do
    Thread.start(server.accept) do |conn|
      begin
        request = +''
        while (line = conn.gets) && line != "\r\n" && !line.nil?
          request << line
        end
        content_length = request[/Content-Length: (\d+)/i, 1].to_i
        body = content_length.positive? ? conn.read(content_length) : ''
        $received << JSON.parse(body)
        payload = { success: true, licenseMode: 'COUNT', license_mode: 'COUNT', remainingCount: 9, valid: true }.to_json
        sig = OpenSSL::HMAC.hexdigest('SHA256', $secret, payload)
        ts = (Process.clock_gettime(Process::CLOCK_REALTIME) * 1000).round
        conn.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nx-license-signature: #{sig}\r\nx-license-timestamp: #{ts}\r\nContent-Length: #{payload.bytesize}\r\n\r\n#{payload}")
      rescue StandardError => e
        warn "handler: #{e.class}: #{e.message}"
      ensure
        conn.close
      end
    end
  end
end

# 1. activate + 验签通过
client = ActivationManagerClient.new(base_url: "http://127.0.0.1:#{$port}", project_key: 'demo', response_secret: $secret)
result = client.activate(code: 'CODE-1', machine_id: 'm-1')
raise 'success expected' unless result['success'] == true
raise 'licenseMode expected' unless result['licenseMode'] == 'COUNT' || result['license_mode'] == 'COUNT'
puts '✅ activate + 验签 OK'

# 2. projectKey 覆盖
client.activate(code: 'CODE-2', machine_id: 'm-2', project_key: 'override')
raise 'projectKey override failed' unless $received.last['projectKey'] == 'override'
puts '✅ projectKey 覆盖 OK'

# 3. 验签失败
bad = ActivationManagerClient.new(base_url: "http://127.0.0.1:#{$port}", response_secret: 'wrong')
begin
  bad.activate(code: 'C', machine_id: 'm')
  raise 'should raise'
rescue ActivationManagerClientError => e
  raise 'wrong kind' unless e.kind.start_with?('SIGNATURE')
  puts "✅ 签名校验失败正确抛出: #{e.kind}"
end

server.close
puts '✅ Ruby SDK 自测通过'
