/*
 * activation_manager.h — Activation Manager License API SDK (C11)
 *
 * 与 src/lib/license-sdk.ts（JS/TS SDK）等价的 C 实现核心：
 *   - activate / status / consume 三个正式接口
 *   - 统一 camelCase 请求；响应 JSON 原文 + 常用字段便捷读取（双字段归一）
 *   - 可选 projectKey 默认值，单次调用可覆盖
 *   - 超时（毫秒）/ 重试（仅瞬时网络错误；consume 建议配 requestId 保证幂等）
 *   - 可选响应验签（HMAC-SHA256 + 5 分钟时间窗）
 *
 * 依赖：libcurl（HTTP）与 OpenSSL 3（HMAC 验签，仅当启用 AM_HAVE_OPENSSL）。
 * 编译示例（macOS/homebrew）：
 *   cc -std=c11 -c activation_manager.c -I/opt/homebrew/opt/openssl/include
 *   cc -std=c11 client.o -L/opt/homebrew/opt/openssl/lib -lssl -lcrypto -lcurl -o demo
 *
 * 用法：
 *   am_client *c = am_client_new(&(am_client_options){
 *       .base_url = "http://127.0.0.1:3000",
 *       .project_key = "browser-plugin",
 *       .timeout_ms = 10000,
 *       .max_retries = 1,
 *   });
 *   am_result *r = am_activate(c, "A1B2C3D4E5F6G7H8", "machine-001", NULL);
 *   if (!r->success) printf("激活失败: %s\n", r->message);
 *   am_result_free(r);
 *   am_client_free(c);
 */

#ifndef ACTIVATION_MANAGER_H
#define ACTIVATION_MANAGER_H

#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* 错误分类，与 JS/Python/Go SDK 对齐 */
typedef enum {
    AM_OK = 0,             /* 成功（业务失败仍为 AM_OK，看 result->success） */
    AM_ERR_NETWORK,        /* 网络请求失败 */
    AM_ERR_TIMEOUT,        /* 请求超时 */
    AM_ERR_INVALID_RESPONSE, /* 响应不是合法 JSON 对象 */
    AM_ERR_HTTP,           /* 服务端返回错误状态码（且无业务 body） */
    AM_ERR_SIGNATURE_MISSING,
    AM_ERR_SIGNATURE_EXPIRED,
    AM_ERR_SIGNATURE_INVALID,
    AM_ERR_NOMEM,
    AM_ERR_INVALID_ARG,
} am_err;

/* 时间窗：5 分钟（毫秒） */
#define AM_SIGNATURE_MAX_AGE_MS (5 * 60 * 1000LL)

typedef struct am_client am_client;

typedef struct {
    const char *base_url;    /* 必填，如 "http://127.0.0.1:3000" */
    const char *project_key; /* 默认 projectKey（可 NULL，回退 "default"） */
    long timeout_ms;         /* 单请求超时，默认 10000 */
    int max_retries;         /* 重试次数，默认 0 */
    long retry_delay_ms;     /* 重试间隔毫秒，默认 200 */
    const char *response_secret; /* 响应验签密钥（NULL/空 = 不验签） */
} am_client_options;

/* 请求结果。raw_body 为服务端 JSON 原文；便捷字段已做双字段归一。 */
typedef struct {
    bool success;
    char *message;       /* 服务端 message；NULL = 无 */
    char *license_mode;  /* camelCase 优先，回退 snake_case；NULL = 无 */
    long long remaining_count; /* 有效值；AM_NO_VALUE 表示无 */
    bool has_remaining_count;
    char *expires_at;    /* 同上归一；NULL = 无 */
    char *raw_body;      /* JSON 原文 */
    am_err error;        /* AM_OK = 请求成功；否则为错误分类 */
    char *error_message; /* 错误详情（error != AM_OK 时）；NULL = 无 */
    int attempt_count;
} am_result;

#define AM_NO_VALUE (-1LL)

/* 生命周期 */
am_client *am_client_new(const am_client_options *options);
void am_client_free(am_client *client);

/* 三个正式接口。project_key/request_id 传 NULL 表示使用默认 / 不带。
 * 返回的 am_result 总是非 NULL（错误时 error != AM_OK），用 am_result_free 释放。 */
am_result *am_activate(am_client *client, const char *code, const char *machine_id, const char *project_key);
am_result *am_status(am_client *client, const char *code, const char *machine_id, const char *project_key);
/* consume：仅当 request_id 非 NULL 且非空时允许重试（防重复扣次） */
am_result *am_consume(am_client *client, const char *code, const char *machine_id, const char *request_id, const char *project_key);

/* 结果释放 */
void am_result_free(am_result *result);

/* 工具：错误分类的英文短描述（用于日志） */
const char *am_err_str(am_err err);

#ifdef __cplusplus
}
#endif

#endif /* ACTIVATION_MANAGER_H */
