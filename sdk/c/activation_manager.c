/*
 * activation_manager.c — Activation Manager License API SDK (C11)
 * 实现见 activation_manager.h 顶部说明。
 *
 * HTTP 用 libcurl；JSON 组装手工拼接（请求端字段受控，无需完整 JSON 库）；
 * 响应解析用轻量字段提取（"key":"value" / 数字 / true|false|null，服务端响应为扁平对象）；
 * 验签用 OpenSSL HMAC，编译期定义 AM_HAVE_OPENSSL 启用。
 */

#include "activation_manager.h"

#include <curl/curl.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <time.h>

#ifdef AM_HAVE_OPENSSL
#include <openssl/hmac.h>
#include <openssl/evp.h>
#endif

#define AM_DEFAULT_TIMEOUT_MS 10000L
#define AM_DEFAULT_RETRY_DELAY_MS 200L
#define AM_SIGNATURE_HEADER "x-license-signature"
#define AM_TIMESTAMP_HEADER "x-license-timestamp"

struct am_client {
    char *base_url;
    char *project_key;
    long timeout_ms;
    int max_retries;
    long retry_delay_ms;
    char *response_secret;
    CURL *curl; /* 复用句柄 */
};

/* ---------- 字符串工具 ---------- */

static char *am_strdup(const char *s) {
    if (!s) return NULL;
    size_t n = strlen(s);
    char *p = malloc(n + 1);
    if (!p) return NULL;
    memcpy(p, s, n + 1);
    return p;
}

static void am_free(void *p) { free(p); }

/* ---------- 结果 ---------- */

void am_result_free(am_result *result) {
    if (!result) return;
    am_free(result->message);
    am_free(result->license_mode);
    am_free(result->expires_at);
    am_free(result->raw_body);
    am_free(result->error_message);
    am_free(result);
}

const char *am_err_str(am_err err) {
    switch (err) {
        case AM_OK: return "OK";
        case AM_ERR_NETWORK: return "NETWORK_ERROR";
        case AM_ERR_TIMEOUT: return "TIMEOUT";
        case AM_ERR_INVALID_RESPONSE: return "INVALID_RESPONSE";
        case AM_ERR_HTTP: return "HTTP_ERROR";
        case AM_ERR_SIGNATURE_MISSING: return "SIGNATURE_MISSING";
        case AM_ERR_SIGNATURE_EXPIRED: return "SIGNATURE_EXPIRED";
        case AM_ERR_SIGNATURE_INVALID: return "SIGNATURE_INVALID";
        case AM_ERR_NOMEM: return "NOMEM";
        case AM_ERR_INVALID_ARG: return "INVALID_ARG";
    }
    return "UNKNOWN";
}

static am_result *am_result_new(void) {
    am_result *r = calloc(1, sizeof(am_result));
    return r;
}

/* 失败结果（error != AM_OK） */
static am_result *am_fail(am_err err, const char *message, int attempt) {
    am_result *r = am_result_new();
    if (!r) return NULL;
    r->error = err;
    r->error_message = am_strdup(message ? message : "");
    r->attempt_count = attempt;
    return r;
}

/* ---------- 客户端 ---------- */

am_client *am_client_new(const am_client_options *options) {
    if (!options || !options->base_url) return NULL;
    am_client *c = calloc(1, sizeof(am_client));
    if (!c) return NULL;

    c->base_url = am_strdup(options->base_url);
    c->project_key = am_strdup(options->project_key ? options->project_key : "default");
    c->timeout_ms = options->timeout_ms > 0 ? options->timeout_ms : AM_DEFAULT_TIMEOUT_MS;
    c->max_retries = options->max_retries > 0 ? options->max_retries : 0;
    c->retry_delay_ms = options->retry_delay_ms > 0 ? options->retry_delay_ms : AM_DEFAULT_RETRY_DELAY_MS;
    c->response_secret = am_strdup(options->response_secret);
    c->curl = curl_easy_init();

    if (!c->base_url || !c->project_key || !c->curl) {
        am_client_free(c);
        return NULL;
    }
    return c;
}

void am_client_free(am_client *client) {
    if (!client) return;
    am_free(client->base_url);
    am_free(client->project_key);
    am_free(client->response_secret);
    if (client->curl) curl_easy_cleanup(client->curl);
    am_free(client);
}

/* ---------- JSON 响应字段提取（扁平对象专用） ---------- */

/* 在 body 中找 "key" 后的值；返回 malloc 的字符串（调用方释放），未找到返回 NULL。 */
static char *am_json_find_string(const char *body, const char *key) {
    char pattern[128];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char *p = strstr(body, pattern);
    if (!p) return NULL;
    p = strchr(p + strlen(pattern), ':');
    if (!p) return NULL;
    p++;
    while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') p++;
    if (*p != '"') return NULL; /* 只取字符串值 */
    p++;
    const char *end = p;
    while (*end && !(*end == '"' && *(end - 1) != '\\')) end++;
    size_t n = (size_t)(end - p);
    char *out = malloc(n + 1);
    if (!out) return NULL;
    /* 简单反转义 */
    size_t j = 0;
    for (size_t i = 0; i < n; i++) {
        if (p[i] == '\\' && i + 1 < n) {
            i++;
            switch (p[i]) {
                case 'n': out[j++] = '\n'; break;
                case 'r': out[j++] = '\r'; break;
                case 't': out[j++] = '\t'; break;
                default: out[j++] = p[i];
            }
        } else {
            out[j++] = p[i];
        }
    }
    out[j] = '\0';
    return out;
}

/* 数字字段 */
static bool am_json_find_number(const char *body, const char *key, long long *out) {
    char pattern[128];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char *p = strstr(body, pattern);
    if (!p) return false;
    p = strchr(p + strlen(pattern), ':');
    if (!p) return false;
    p++;
    while (*p == ' ') p++;
    char *endp = NULL;
    long long v = strtoll(p, &endp, 10);
    if (endp == p) return false;
    *out = v;
    return true;
}

/* ---------- 请求体组装 ---------- */

/* 简易 JSON 字符串转义（用于受控请求字段） */
static char *am_json_escape(const char *s) {
    size_t n = strlen(s);
    char *out = malloc(n * 2 + 1);
    if (!out) return NULL;
    size_t j = 0;
    for (size_t i = 0; i < n; i++) {
        if (s[i] == '"' || s[i] == '\\') out[j++] = '\\';
        out[j++] = s[i];
    }
    out[j] = '\0';
    return out;
}

static char *am_build_payload(const char *code, const char *machine_id, const char *request_id, const char *project_key) {
    char *code_e = am_json_escape(code ? code : "");
    char *mid_e = am_json_escape(machine_id ? machine_id : "");
    char *pk_e = am_json_escape(project_key ? project_key : "default");
    if (!code_e || !mid_e || !pk_e) {
        am_free(code_e); am_free(mid_e); am_free(pk_e);
        return NULL;
    }
    size_t cap = strlen(code_e) + strlen(mid_e) + strlen(pk_e) + 128;
    char *body = malloc(cap);
    if (!body) {
        am_free(code_e); am_free(mid_e); am_free(pk_e);
        return NULL;
    }
    if (request_id && *request_id) {
        char *rid_e = am_json_escape(request_id);
        snprintf(body, cap,
                 "{\"code\":\"%s\",\"machineId\":\"%s\",\"requestId\":\"%s\",\"projectKey\":\"%s\"}",
                 code_e, mid_e, rid_e ? rid_e : "", pk_e);
        am_free(rid_e);
    } else {
        snprintf(body, cap,
                 "{\"code\":\"%s\",\"machineId\":\"%s\",\"projectKey\":\"%s\"}",
                 code_e, mid_e, pk_e);
    }
    am_free(code_e); am_free(mid_e); am_free(pk_e);
    return body;
}

/* ---------- 响应解析 ---------- */

static void am_parse_response(am_result *r, const char *body) {
    /* success：找 "success":true|false */
    const char *p = strstr(body, "\"success\"");
    if (p) {
        p = strchr(p, ':');
        if (p) {
            p++;
            while (*p == ' ') p++;
            r->success = strncmp(p, "true", 4) == 0;
        }
    }

    r->message = am_json_find_string(body, "message");

    /* 双字段归一：camelCase 优先 */
    r->license_mode = am_json_find_string(body, "licenseMode");
    if (!r->license_mode) r->license_mode = am_json_find_string(body, "license_mode");

    r->expires_at = am_json_find_string(body, "expiresAt");
    if (!r->expires_at) r->expires_at = am_json_find_string(body, "expires_at");

    long long remaining = 0;
    if (am_json_find_number(body, "remainingCount", &remaining) ||
        am_json_find_number(body, "remaining_count", &remaining)) {
        r->remaining_count = remaining;
        r->has_remaining_count = true;
    }
}

/* ---------- HTTP ---------- */

typedef struct {
    char *data;
    size_t size;
} am_buf;

static size_t am_write_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    am_buf *buf = (am_buf *)userdata;
    size_t total = size * nmemb;
    char *next = realloc(buf->data, buf->size + total + 1);
    if (!next) return 0; /* curl 视为错误 */
    buf->data = next;
    memcpy(buf->data + buf->size, ptr, total);
    buf->size += total;
    buf->data[buf->size] = '\0';
    return total;
}

/* 提取响应头中的单值（header_text 为完整头块） */
static void am_header_get(const char *header_text, const char *name, char *out, size_t out_size) {
    out[0] = '\0';
    size_t name_len = strlen(name);
    const char *line = header_text;
    while (line && *line) {
        const char *eol = strstr(line, "\r\n");
        size_t line_len = eol ? (size_t)(eol - line) : strlen(line);
        if (line_len > name_len + 1 && strncasecmp(line, name, name_len) == 0 && line[name_len] == ':') {
            const char *v = line + name_len + 1;
            while (*v == ' ') v++;
            size_t vlen = line_len - (size_t)(v - line);
            if (vlen >= out_size) vlen = out_size - 1;
            memcpy(out, v, vlen);
            out[vlen] = '\0';
            return;
        }
        line = eol ? eol + 2 : NULL;
    }
}

#ifdef AM_HAVE_OPENSSL
static bool am_now_ms(long long *out) {
    struct timespec ts;
#ifdef CLOCK_REALTIME
    if (clock_gettime(CLOCK_REALTIME, &ts) != 0) return false;
#else
    if (clock_gettime(CLOCK_REAL, &ts) != 0) return false;
#endif
    *out = (long long)ts.tv_sec * 1000LL + ts.tv_nsec / 1000000LL;
    return true;
}

static am_err am_verify_signature(const char *header_text, const char *body, const char *secret) {
    char signature[129];
    char timestamp[32];
    am_header_get(header_text, AM_SIGNATURE_HEADER, signature, sizeof(signature));
    am_header_get(header_text, AM_TIMESTAMP_HEADER, timestamp, sizeof(timestamp));
    if (!signature[0] || !timestamp[0]) return AM_ERR_SIGNATURE_MISSING;

    char *endp = NULL;
    long long ts = strtoll(timestamp, &endp, 10);
    if (endp == timestamp) return AM_ERR_SIGNATURE_INVALID;

    long long now = 0;
    if (!am_now_ms(&now)) return AM_ERR_SIGNATURE_INVALID;
    long long diff = now - ts;
    if (diff < 0) diff = -diff;
    if (diff > AM_SIGNATURE_MAX_AGE_MS) return AM_ERR_SIGNATURE_EXPIRED;

    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int digest_len = 0;
    HMAC(EVP_sha256(), secret, (int)strlen(secret),
         (const unsigned char *)body, strlen(body), digest, &digest_len);

    char expected[EVP_MAX_MD_SIZE * 2 + 1];
    for (unsigned int i = 0; i < digest_len; i++) {
        snprintf(expected + i * 2, 3, "%02x", digest[i]);
    }
    if (strlen(signature) != strlen(expected) ||
        memcmp(signature, expected, strlen(expected)) != 0) {
        return AM_ERR_SIGNATURE_INVALID;
    }
    return AM_OK;
}
#endif /* AM_HAVE_OPENSSL */

/* 单次 HTTP 尝试。成功返回 AM_OK（业务失败也算），其他为错误。 */
static am_err am_attempt(am_client *c, const char *path, const char *payload,
                         long *status_code, am_buf *body, am_buf *headers) {
    char url[1024];
    snprintf(url, sizeof(url), "%s%s", c->base_url, path);

    curl_easy_reset(c->curl);
    curl_easy_setopt(c->curl, CURLOPT_URL, url);
    curl_easy_setopt(c->curl, CURLOPT_POST, 1L);
    curl_easy_setopt(c->curl, CURLOPT_POSTFIELDS, payload);
    curl_easy_setopt(c->curl, CURLOPT_TIMEOUT_MS, c->timeout_ms);
    curl_easy_setopt(c->curl, CURLOPT_WRITEFUNCTION, am_write_cb);
    curl_easy_setopt(c->curl, CURLOPT_WRITEDATA, body);
    curl_easy_setopt(c->curl, CURLOPT_HEADERFUNCTION, am_write_cb);
    curl_easy_setopt(c->curl, CURLOPT_HEADERDATA, headers);

    struct curl_slist *hdrs = NULL;
    hdrs = curl_slist_append(hdrs, "Content-Type: application/json");
    curl_easy_setopt(c->curl, CURLOPT_HTTPHEADER, hdrs);

    CURLcode code = curl_easy_perform(c->curl);
    curl_slist_free_all(hdrs);

    if (code != CURLE_OK) {
        return code == CURLE_OPERATION_TIMEDOUT ? AM_ERR_TIMEOUT : AM_ERR_NETWORK;
    }

    long http_code = 0;
    curl_easy_getinfo(c->curl, CURLINFO_RESPONSE_CODE, &http_code);
    *status_code = http_code;
    return AM_OK;
}

/* ---------- 公开接口 ---------- */

static am_result *am_call(am_client *c, const char *path, const char *code,
                          const char *machine_id, const char *request_id,
                          const char *project_key, bool allow_retry) {
    int attempt_total = (allow_retry && c->max_retries > 0) ? c->max_retries + 1 : 1;
    am_result *last_fail = NULL;

    char *payload = am_build_payload(code, machine_id, request_id,
                                     project_key && *project_key ? project_key : c->project_key);
    if (!payload) {
        am_result *r = am_fail(AM_ERR_NOMEM, "out of memory building payload", 1);
        return r;
    }

    for (int attempt = 1; attempt <= attempt_total; attempt++) {
        am_buf body = {0};
        am_buf headers = {0};
        long status_code = 0;

        am_err err = am_attempt(c, path, payload, &status_code, &body, &headers);

        if (err == AM_ERR_NETWORK || err == AM_ERR_TIMEOUT) {
            {
                char msg[128];
                snprintf(msg, sizeof(msg), "%s", am_err_str(err));
                last_fail = am_fail(err, msg, attempt);
            }
            free(body.data);
            free(headers.data);
            if (attempt < attempt_total) {
                struct timespec ts = { .tv_sec = 0, .tv_nsec = c->retry_delay_ms * 1000000L };
                nanosleep(&ts, NULL);
                continue;
            }
            am_free(payload);
            return last_fail;
        }

#ifdef AM_HAVE_OPENSSL
        if (c->response_secret && *c->response_secret) {
            am_err sig_err = am_verify_signature(headers.data ? headers.data : "", body.data ? body.data : "", c->response_secret);
            if (sig_err != AM_OK) {
                free(body.data);
                free(headers.data);
                am_free(payload);
                return am_fail(sig_err, "signature verification failed", attempt);
            }
        }
#else
        (void)headers;
#endif

        const char *body_text = body.data ? body.data : "";
        am_result *r = am_result_new();
        if (!r) {
            free(body.data);
            free(headers.data);
            am_free(payload);
            return am_fail(AM_ERR_NOMEM, "out of memory", attempt);
        }
        r->attempt_count = attempt;

        bool has_success_key = strstr(body_text, "\"success\"") != NULL;
        if (status_code >= 400 && !has_success_key) {
            r->error = AM_ERR_HTTP;
            char msg[32];
            snprintf(msg, sizeof(msg), "HTTP %ld", status_code);
            r->error_message = am_strdup(msg);
            am_result_free(r);
            free(body.data);
            free(headers.data);
            am_free(payload);
            return am_fail(AM_ERR_HTTP, msg, attempt);
        }
        if (!has_success_key) {
            r->error = AM_ERR_INVALID_RESPONSE;
            am_result_free(r);
            free(body.data);
            free(headers.data);
            am_free(payload);
            return am_fail(AM_ERR_INVALID_RESPONSE, "response is not a JSON object", attempt);
        }

        am_parse_response(r, body_text);
        r->raw_body = am_strdup(body_text);
        r->error = AM_OK;

        free(body.data);
        free(headers.data);
        am_free(payload);
        return r;
    }
    am_free(payload);
    return last_fail ? last_fail : am_fail(AM_ERR_NETWORK, "unreachable", 1);
}

am_result *am_activate(am_client *c, const char *code, const char *machine_id, const char *project_key) {
    if (!c || !code || !machine_id) return am_fail(AM_ERR_INVALID_ARG, "code and machine_id required", 1);
    return am_call(c, "/api/license/activate", code, machine_id, NULL, project_key, true);
}

am_result *am_status(am_client *c, const char *code, const char *machine_id, const char *project_key) {
    if (!c || !code || !machine_id) return am_fail(AM_ERR_INVALID_ARG, "code and machine_id required", 1);
    return am_call(c, "/api/license/status", code, machine_id, NULL, project_key, true);
}

am_result *am_consume(am_client *c, const char *code, const char *machine_id, const char *request_id, const char *project_key) {
    if (!c || !code || !machine_id) return am_fail(AM_ERR_INVALID_ARG, "code and machine_id required", 1);
    bool allow_retry = request_id && *request_id;
    return am_call(c, "/api/license/consume", code, machine_id, request_id, project_key, allow_retry);
}
