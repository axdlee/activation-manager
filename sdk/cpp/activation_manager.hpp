// activation_manager.hpp — Activation Manager License API SDK (C++17)
//
// 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 C++ 单文件实现（header-only）：
//   - activate / status / consume 三个正式接口
//   - 统一 camelCase 请求；响应双字段（camelCase/snake_case）取值归一
//   - 可选 projectKey 默认值，单次调用可覆盖
//   - 超时 / 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
//   - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
//
// 依赖：libcurl（HTTP）与 OpenSSL（HMAC 验签）。
// 用法（header-only，包含本头文件即可）：
//
//   #include "activation_manager.hpp"
//
//   activation_manager::client client({
//       .base_url = "http://127.0.0.1:3000",
//       .project_key = "browser-plugin",
//   });
//   auto result = client.activate("A1B2C3D4E5F6G7H8", "machine-001");
//   if (!result.success) std::println("激活失败: {}", result.message);
//
// 编译：g++ -std=c++17 demo.cpp -lcurl -lssl -lcrypto

#ifndef ACTIVATION_MANAGER_HPP
#define ACTIVATION_MANAGER_HPP

#include <curl/curl.h>

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <cstring>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <thread>

#ifdef AM_HAVE_OPENSSL
#include <openssl/evp.h>
#include <openssl/hmac.h>
#endif

namespace activation_manager {

inline constexpr const char* kSignatureHeader = "x-license-signature";
inline constexpr const char* kTimestampHeader = "x-license-timestamp";
inline constexpr long long kSignatureMaxAgeMs = 5 * 60 * 1000LL;

// 错误分类，与 JS/Python/Go SDK 对齐。
enum class error_kind {
    ok,
    network_error,
    timeout,
    invalid_response,
    http_error,
    signature_missing,
    signature_expired,
    signature_invalid,
};

inline const char* to_string(error_kind kind) {
    switch (kind) {
        case error_kind::ok: return "OK";
        case error_kind::network_error: return "NETWORK_ERROR";
        case error_kind::timeout: return "TIMEOUT";
        case error_kind::invalid_response: return "INVALID_RESPONSE";
        case error_kind::http_error: return "HTTP_ERROR";
        case error_kind::signature_missing: return "SIGNATURE_MISSING";
        case error_kind::signature_expired: return "SIGNATURE_EXPIRED";
        case error_kind::signature_invalid: return "SIGNATURE_INVALID";
    }
    return "UNKNOWN";
}

// 网络异常/超时/签名失败时抛出；业务失败通过 result.success=false 判断。
class client_exception : public std::exception {
public:
    client_exception(error_kind kind, std::string message, std::string path = "", int attempt = 1)
        : kind_(kind), message_(std::move(message)), path_(std::move(path)), attempt_(attempt) {}

    const char* what() const noexcept override { return message_.c_str(); }
    error_kind kind() const noexcept { return kind_; }
    const std::string& path() const noexcept { return path_; }
    int attempt_count() const noexcept { return attempt_; }

private:
    error_kind kind_;
    std::string message_;
    std::string path_;
    int attempt_;
};

// 服务端响应（双字段归一化取值）。
struct result {
    bool success = false;
    std::string message;
    std::string license_mode;   // camelCase 优先，回退 snake_case
    std::string expires_at;
    std::optional<long long> remaining_count;
    std::optional<bool> is_activated;
    std::optional<bool> valid;
    std::optional<bool> idempotent;
    std::string raw_body;       // JSON 原文
};

// 客户端配置。
struct client_options {
    std::string base_url = "http://127.0.0.1:3000";
    std::string project_key = "default";
    long timeout_ms = 10000;
    int max_retries = 0;
    long retry_delay_ms = 200;
    std::map<std::string, std::string> headers;
    std::string response_secret; // 空 = 不验签
};

namespace detail {

inline std::string json_escape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char c : s) {
        if (c == '"' || c == '\\') out += '\\';
        out += c;
    }
    return out;
}

// 轻量 JSON 扁平对象字段提取（服务端响应为扁平对象，无需完整 JSON 库）。
inline std::optional<std::string> find_string(const std::string& body, const std::string& key) {
    const std::string pattern = "\"" + key + "\"";
    auto pos = body.find(pattern);
    if (pos == std::string::npos) return std::nullopt;
    pos = body.find(':', pos + pattern.size());
    if (pos == std::string::npos) return std::nullopt;
    ++pos;
    while (pos < body.size() && std::isspace(static_cast<unsigned char>(body[pos]))) ++pos;
    if (pos >= body.size() || body[pos] != '"') return std::nullopt;
    ++pos;
    std::string out;
    while (pos < body.size()) {
        if (body[pos] == '\\' && pos + 1 < body.size()) {
            ++pos;
            switch (body[pos]) {
                case 'n': out += '\n'; break;
                case 'r': out += '\r'; break;
                case 't': out += '\t'; break;
                default: out += body[pos];
            }
        } else if (body[pos] == '"') {
            return out;
        } else {
            out += body[pos];
        }
        ++pos;
    }
    return std::nullopt;
}

inline std::optional<long long> find_number(const std::string& body, const std::string& key) {
    const std::string pattern = "\"" + key + "\"";
    auto pos = body.find(pattern);
    if (pos == std::string::npos) return std::nullopt;
    pos = body.find(':', pos + pattern.size());
    if (pos == std::string::npos) return std::nullopt;
    ++pos;
    while (pos < body.size() && std::isspace(static_cast<unsigned char>(body[pos]))) ++pos;
    if (pos >= body.size()) return std::nullopt;
    try {
        size_t idx = 0;
        long long v = std::stoll(body.substr(pos), &idx);
        (void)idx;
        return v;
    } catch (...) {
        return std::nullopt;
    }
}

inline std::optional<bool> find_bool(const std::string& body, const std::string& key) {
    const std::string pattern = "\"" + key + "\":";
    auto pos = body.find(pattern);
    if (pos == std::string::npos) return std::nullopt;
    pos += pattern.size();
    while (pos < body.size() && std::isspace(static_cast<unsigned char>(body[pos]))) ++pos;
    if (body.compare(pos, 4, "true") == 0) return true;
    if (body.compare(pos, 5, "false") == 0) return false;
    return std::nullopt;
}

inline result parse_response(const std::string& body) {
    result r;
    r.raw_body = body;
    if (auto v = find_bool(body, "success")) r.success = *v;
    if (auto v = find_string(body, "message")) r.message = *v;

    // 双字段归一：camelCase 优先
    if (auto v = find_string(body, "licenseMode")) r.license_mode = *v;
    else if (auto v2 = find_string(body, "license_mode")) r.license_mode = *v2;

    if (auto v = find_string(body, "expiresAt")) r.expires_at = *v;
    else if (auto v2 = find_string(body, "expires_at")) r.expires_at = *v2;

    if (auto v = find_number(body, "remainingCount")) r.remaining_count = *v;
    else if (auto v2 = find_number(body, "remaining_count")) r.remaining_count = *v2;

    if (auto v = find_bool(body, "isActivated")) r.is_activated = *v;
    else if (auto v2 = find_bool(body, "is_activated")) r.is_activated = *v2;

    r.valid = find_bool(body, "valid");
    r.idempotent = find_bool(body, "idempotent");
    return r;
}

struct http_buffer {
    char* data = nullptr;
    size_t size = 0;

    static size_t write(char* ptr, size_t size, size_t nmemb, void* userdata) {
        auto* buf = static_cast<http_buffer*>(userdata);
        size_t total = size * nmemb;
        char* next = static_cast<char*>(std::realloc(buf->data, buf->size + total + 1));
        if (!next) return 0;
        buf->data = next;
        std::memcpy(buf->data + buf->size, ptr, total);
        buf->size += total;
        buf->data[buf->size] = '\0';
        return total;
    }

    std::string str() const { return data ? std::string(data, size) : std::string(); }

    ~http_buffer() { std::free(data); }
};

inline std::string header_get(const std::string& headers, const std::string& name) {
    size_t pos = 0;
    std::string lower_name = name;
    std::transform(lower_name.begin(), lower_name.end(), lower_name.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    while (pos < headers.size()) {
        size_t eol = headers.find("\r\n", pos);
        size_t line_len = eol == std::string::npos ? headers.size() - pos : eol - pos;
        std::string line = headers.substr(pos, line_len);
        if (line.size() > name.size() + 1) {
            std::string lower_line = line;
            std::transform(lower_line.begin(), lower_line.end(), lower_line.begin(),
                           [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
            if (lower_line.compare(0, name.size(), lower_name) == 0 && line[name.size()] == ':') {
                size_t v = line.find_first_not_of(' ', name.size() + 1);
                return v == std::string::npos ? "" : line.substr(v);
            }
        }
        if (eol == std::string::npos) break;
        pos = eol + 2;
    }
    return "";
}

#ifdef AM_HAVE_OPENSSL
inline long long now_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::system_clock::now().time_since_epoch())
        .count();
}

inline void verify_signature(const std::string& headers, const std::string& body, const std::string& secret) {
    std::string signature = header_get(headers, kSignatureHeader);
    std::string timestamp = header_get(headers, kTimestampHeader);
    if (signature.empty() || timestamp.empty()) {
        throw client_exception(error_kind::signature_missing, "missing signature headers");
    }
    long long ts = 0;
    try {
        ts = std::stoll(timestamp);
    } catch (...) {
        throw client_exception(error_kind::signature_invalid, "invalid signature timestamp");
    }
    if (std::abs(now_ms() - ts) > kSignatureMaxAgeMs) {
        throw client_exception(error_kind::signature_expired, "signature timestamp outside window");
    }
    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int digest_len = 0;
    HMAC(EVP_sha256(), secret.data(), static_cast<int>(secret.size()),
         reinterpret_cast<const unsigned char*>(body.data()), body.size(), digest, &digest_len);
    std::string expected;
    expected.reserve(digest_len * 2);
    static const char* hex = "0123456789abcdef";
    for (unsigned int i = 0; i < digest_len; ++i) {
        expected += hex[(digest[i] >> 4) & 0xF];
        expected += hex[digest[i] & 0xF];
    }
    if (expected != signature) {
        throw client_exception(error_kind::signature_invalid, "response signature mismatch");
    }
}
#endif  // AM_HAVE_OPENSSL

}  // namespace detail

// License API 客户端。
class client {
public:
    explicit client(client_options options)
        : opts_(std::move(options)), curl_(curl_easy_init(), &curl_easy_cleanup) {
        if (!curl_) throw client_exception(error_kind::network_error, "curl init failed");
    }

    // 激活：绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数。
    result activate(const std::string& code, const std::string& machine_id, const std::string& project_key = "") {
        return call("/api/license/activate", code, machine_id, "", project_key, /*allow_retry=*/true);
    }

    // 查询状态：剩余次数 / 过期时间 / 是否已绑定。
    result status(const std::string& code, const std::string& machine_id, const std::string& project_key = "") {
        return call("/api/license/status", code, machine_id, "", project_key, /*allow_retry=*/true);
    }

    // 消费：COUNT 型扣减 1 次（request_id 幂等）；TIME 型仅校验。
    // 重试仅在传了 request_id 时启用（防重复扣次）。
    result consume(const std::string& code, const std::string& machine_id,
                   const std::string& request_id = "", const std::string& project_key = "") {
        bool allow_retry = !request_id.empty();
        return call("/api/license/consume", code, machine_id, request_id, project_key, allow_retry);
    }

private:
    result call(const std::string& path, const std::string& code, const std::string& machine_id,
                const std::string& request_id, const std::string& project_key, bool allow_retry) {
        const std::string pk = project_key.empty() ? opts_.project_key : project_key;
        std::string payload = "{\"code\":\"" + detail::json_escape(code) +
                              "\",\"machineId\":\"" + detail::json_escape(machine_id) + "\"";
        if (!request_id.empty()) {
            payload += ",\"requestId\":\"" + detail::json_escape(request_id) + "\"";
        }
        payload += ",\"projectKey\":\"" + detail::json_escape(pk) + "\"}";

        int total_attempts = (allow_retry && opts_.max_retries > 0) ? opts_.max_retries + 1 : 1;
        client_exception last(error_kind::network_error, "unreachable");

        for (int attempt = 1; attempt <= total_attempts; ++attempt) {
            try {
                return attempt_once(path, payload, attempt);
            } catch (const client_exception& e) {
                last = e;
                if (attempt < total_attempts) {
                    std::this_thread::sleep_for(std::chrono::milliseconds(opts_.retry_delay_ms));
                }
            }
        }
        throw last;
    }

    result attempt_once(const std::string& path, const std::string& payload, int attempt) {
        std::string url = opts_.base_url + path;

        curl_easy_reset(curl_.get());
        curl_easy_setopt(curl_.get(), CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl_.get(), CURLOPT_POST, 1L);
        curl_easy_setopt(curl_.get(), CURLOPT_POSTFIELDS, payload.c_str());
        curl_easy_setopt(curl_.get(), CURLOPT_TIMEOUT_MS, opts_.timeout_ms);
        curl_easy_setopt(curl_.get(), CURLOPT_WRITEFUNCTION, &detail::http_buffer::write);

        detail::http_buffer body_buf;
        detail::http_buffer header_buf;
        curl_easy_setopt(curl_.get(), CURLOPT_WRITEDATA, &body_buf);
        curl_easy_setopt(curl_.get(), CURLOPT_HEADERFUNCTION, &detail::http_buffer::write);
        curl_easy_setopt(curl_.get(), CURLOPT_HEADERDATA, &header_buf);

        struct curl_slist* hdrs = nullptr;
        hdrs = curl_slist_append(hdrs, "Content-Type: application/json");
        for (const auto& [name, value] : opts_.headers) {
            hdrs = curl_slist_append(hdrs, (name + ": " + value).c_str());
        }
        curl_easy_setopt(curl_.get(), CURLOPT_HTTPHEADER, hdrs);

        CURLcode code = curl_easy_perform(curl_.get());
        curl_slist_free_all(hdrs);

        if (code == CURLE_OPERATION_TIMEDOUT) {
            throw client_exception(error_kind::timeout, "request timed out", path, attempt);
        }
        if (code != CURLE_OK) {
            throw client_exception(error_kind::network_error, "curl error " + std::to_string(static_cast<int>(code)), path, attempt);
        }

        std::string body = body_buf.str();
        std::string header_text = header_buf.str();

#ifdef AM_HAVE_OPENSSL
        if (!opts_.response_secret.empty()) {
            detail::verify_signature(header_text, body, opts_.response_secret);
        }
#endif

        long status_code = 0;
        curl_easy_getinfo(curl_.get(), CURLINFO_RESPONSE_CODE, &status_code);

        bool has_success_key = body.find("\"success\"") != std::string::npos;
        if (status_code >= 400 && !has_success_key) {
            throw client_exception(error_kind::http_error, "HTTP " + std::to_string(status_code), path, attempt);
        }
        if (!has_success_key) {
            throw client_exception(error_kind::invalid_response, "response is not a JSON object", path, attempt);
        }

        return detail::parse_response(body);
    }

    client_options opts_;
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl_;
};

}  // namespace activation_manager

#endif  // ACTIVATION_MANAGER_HPP
