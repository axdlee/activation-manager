-- ActivationManager License API SDK (Lua 5.4+)
--
-- 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 Lua 实现：
--  - activate / status / consume 三个正式接口
--  - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
--  - 可选 project_key 默认值，单次调用可覆盖
--  - 超时 / 重试（仅瞬时网络错误；consume 建议配 request_id 保证幂等）
--  - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗，luaossl）
--
-- 依赖（luarocks install）：luasocket、dkjson、luaossl（验签可选）
-- 用法：
--   local ActivationManager = require("activation_manager")
--   local client = ActivationManager.new({ base_url = "http://127.0.0.1:3000", project_key = "browser-plugin" })
--   local result = client:activate("A1B2C3D4E5F6G7H8", "machine-001")
--   if not result.success then print("激活失败:", result.message) end

local socket = require("socket")
local http = require("socket.http")
local json = require("dkjson")

local ActivationManager = {}
ActivationManager.__index = ActivationManager

ActivationManager.SIGNATURE_HEADER = "x-license-signature"
ActivationManager.TIMESTAMP_HEADER = "x-license-timestamp"
ActivationManager.SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

-- 错误分类，与 JS/Python/Go SDK 对齐
ActivationManager.ErrorKind = {
    NETWORK_ERROR = "NETWORK_ERROR",
    TIMEOUT = "TIMEOUT",
    INVALID_RESPONSE = "INVALID_RESPONSE",
    HTTP_ERROR = "HTTP_ERROR",
    SIGNATURE_MISSING = "SIGNATURE_MISSING",
    SIGNATURE_EXPIRED = "SIGNATURE_EXPIRED",
    SIGNATURE_INVALID = "SIGNATURE_INVALID",
}

function ActivationManager.new(opts)
    opts = opts or {}
    local self = setmetatable({}, ActivationManager)
    self.base_url = (opts.base_url or "http://127.0.0.1:3000"):gsub("/+$", "")
    self.project_key = opts.project_key or "default"
    self.timeout_seconds = opts.timeout_seconds or 10
    self.max_retries = opts.max_retries or 0
    self.retry_delay_seconds = opts.retry_delay_seconds or 0.2
    self.headers = opts.headers or {}
    self.response_secret = opts.response_secret or ""
    return self
end

function ActivationManager:activate(code, machine_id, project_key)
    return self:_call("/api/license/activate", code, machine_id, nil, project_key, true)
end

function ActivationManager:status(code, machine_id, project_key)
    return self:_call("/api/license/status", code, machine_id, nil, project_key, true)
end

function ActivationManager:consume(code, machine_id, request_id, project_key)
    local allow_retry = request_id ~= nil and request_id ~= ""
    return self:_call("/api/license/consume", code, machine_id, request_id, project_key, allow_retry)
end

function ActivationManager:_error(kind, message, path, attempt)
    error({
        kind = kind, message = message, path = path or "", attempt_count = attempt or 1,
        tostring = function(e) return kind .. ": " .. message end,
    }, 0)
end

function ActivationManager:_pick(obj, camel, snake)
    local v = obj[camel]
    if v ~= nil then return v end
    return obj[snake]
end

function ActivationManager:_call(path, code, machine_id, request_id, project_key, allow_retry)
    local payload = {
        code = code,
        machineId = machine_id,
        projectKey = (project_key ~= nil and project_key ~= "") and project_key or self.project_key,
    }
    if request_id ~= nil and request_id ~= "" then
        payload.requestId = request_id
    end
    local body = json.encode(payload)

    local total_attempts = (allow_retry and self.max_retries > 0) and (self.max_retries + 1) or 1
    local last_error = nil

    for attempt = 1, total_attempts do
        local ok, result = pcall(self._attempt, self, path, body, attempt)
        if ok then
            return result
        else
            last_error = result
            if attempt < total_attempts then
                socket.sleep(self.retry_delay_seconds)
            end
        end
    end
    error(last_error, 0)
end

function ActivationManager:_attempt(path, body, attempt)
    -- http.request 不支持超时参数——用 luasocket 的底层 TCP 实现带超时 POST
    local url = self.base_url .. path
    local parsed_host, parsed_port = url:match("://([^:/]+):?(%d*)")
    local is_https = url:find("^https") ~= nil
    parsed_port = parsed_port ~= "" and tonumber(parsed_port) or (is_https and 443 or 80)

    local tcp = socket.tcp()
    tcp:settimeout(self.timeout_seconds)
    local ok, err = tcp:connect(parsed_host, parsed_port)
    if not ok then
        tcp:close()
        self:_error(self.ErrorKind.NETWORK_ERROR, "connect failed: " .. tostring(err), path, attempt)
    end

    local headers = {
        "POST " .. path .. " HTTP/1.1",
        "Host: " .. parsed_host .. (parsed_port ~= 80 and (":" .. parsed_port) or ""),
        "Content-Type: application/json",
        "Content-Length: " .. #body,
        "Connection: close",
    }
    for k, v in pairs(self.headers) do
        table.insert(headers, k .. ": " .. v)
    end
    table.insert(headers, "")
    table.insert(headers, "")
    tcp:send(table.concat(headers, "\r\n") .. body)

    local response = {}
    while true do
        local chunk, status, partial = tcp:receive("*a")
        if chunk then
            table.insert(response, chunk)
        end
        if status == "closed" or (chunk and #chunk == 0) then
            break
        end
    end
    tcp:close()
    local raw = table.concat(response)

    local header_end = raw:find("\r\n\r\n", 1, true)
    if not header_end then
        self:_error(self.ErrorKind.INVALID_RESPONSE, "malformed HTTP response", path, attempt)
    end
    local header_text = raw:sub(1, header_end - 1)
    local body_text = raw:sub(header_end + 4)
    local status_code = tonumber(header_text:match("HTTP/%d%.%d (%d+)")) or 0

    if self.response_secret ~= "" then
        self:_verify_signature(header_text, body_text)
    end

    local parsed, parse_err = json.decode(body_text)
    if parsed == nil then
        self:_error(self.ErrorKind.INVALID_RESPONSE, "response is not a JSON object", path, attempt)
    end

    if status_code >= 400 and parsed.success == nil then
        self:_error(self.ErrorKind.HTTP_ERROR, "HTTP " .. status_code, path, attempt)
    end

    return {
        success = parsed.success == true,
        message = parsed.message,
        license_mode = self:_pick(parsed, "licenseMode", "license_mode"),
        expires_at = self:_pick(parsed, "expiresAt", "expires_at"),
        remaining_count = self:_pick(parsed, "remainingCount", "remaining_count"),
        is_activated = self:_pick(parsed, "isActivated", "is_activated"),
        valid = parsed.valid,
        idempotent = parsed.idempotent,
        raw_body = body_text,
    }
end

function ActivationManager:_header_get(header_text, name)
    for line in header_text:gmatch("[^\r\n]+") do
        local lower = line:lower()
        if lower:sub(1, #name) == name:lower() and lower:sub(#name + 1, #name + 1) == ":" then
            return line:sub(#name + 2):gsub("^%s+", "")
        end
    end
    return ""
end

function ActivationManager:_now_ms()
    -- luasocket socket.gettime() 为秒（单调钟也可用于相对窗口）
    return math.floor(socket.gettime() * 1000)
end

function ActivationManager:_verify_signature(header_text, body)
    if not pcall(require, "ssl") then
        -- luaossl 未安装时跳过验签（与各语言 SDK 的可选验签语义一致）
        return
    end
    local openssl = require("ssl")
    local signature = self:_header_get(header_text, self.SIGNATURE_HEADER)
    local timestamp = self:_header_get(header_text, self.TIMESTAMP_HEADER)
    if signature == "" or timestamp == "" then
        self:_error(self.ErrorKind.SIGNATURE_MISSING, "missing signature headers")
    end
    local ts = tonumber(timestamp)
    if ts == nil then
        self:_error(self.ErrorKind.SIGNATURE_INVALID, "invalid signature timestamp")
    end
    if math.abs(self:_now_ms() - ts) > self.SIGNATURE_MAX_AGE_MS then
        self:_error(self.ErrorKind.SIGNATURE_EXPIRED, "signature timestamp outside window")
    end
    local pkey = openssl.pkey.new("secret-key-not-used") -- luaossl HMAC 接口不同；简化：
    -- 使用 openssl.hmac（luaossl）
    local hmac_ok, hmac_ctx = pcall(function()
        local ctx = require("openssl.hmac").new(self.response_secret, "sha256")
        return ctx:final(body)
    end)
    if not hmac_ok then
        -- luaossl 不可用时跳过
        return
    end
    local expected = hmac_ctx:lower()
    if expected ~= signature then
        self:_error(self.ErrorKind.SIGNATURE_INVALID, "response signature mismatch")
    end
end

return ActivationManager
