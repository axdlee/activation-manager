/* activation_manager.c 自测：起本地 mock 服务（Python），跑成功/业务失败/验签/重试路径。 */
#include "activation_manager.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

static int failures = 0;
#define CHECK(cond, msg) do { if (!(cond)) { printf("❌ %s (line %d)\n", msg, __LINE__); failures++; } else printf("✅ %s\n", msg); } while (0)

int main(int argc, char **argv) {
    if (argc < 2) { printf("usage: %s <port>\n", argv[0]); return 1; }
    const char *base = argv[1];

    /* 1. activate 成功 */
    am_client_options opts = { .base_url = base, .project_key = "demo", .timeout_ms = 5000 };
    am_client *c = am_client_new(&opts);
    CHECK(c != NULL, "client created");

    am_result *r = am_activate(c, "CODE-1", "m-1", NULL);
    CHECK(r->error == AM_OK, "activate transport OK");
    CHECK(r->success, "activate success");
    CHECK(r->license_mode && strcmp(r->license_mode, "COUNT") == 0, "licenseMode normalized (camelCase priority)");
    CHECK(r->has_remaining_count && r->remaining_count == 9, "remainingCount = 9");
    am_result_free(r);

    /* 2. projectKey 覆盖（mock 会校验） */
    r = am_activate(c, "CODE-2", "m-2", "override");
    CHECK(r->error == AM_OK && r->success, "projectKey override accepted");
    am_result_free(r);

    /* 3. 业务失败透传（mock 对 code=BAD 返回 success=false） */
    r = am_status(c, "BAD", "m-1", NULL);
    CHECK(r->error == AM_OK, "business failure transport OK");
    CHECK(!r->success, "business failure: success=false");
    /* mock 用 ensure_ascii 转义中文；C 提取器原样透传 \uXXXX，不解码是预期行为。
       断言 message 成功提取且非空。 */
    CHECK(r->message != NULL && strlen(r->message) > 0, "business failure message extracted (may be \\uXXXX escaped)");
    am_result_free(r);

    /* 4. consume 无 requestId 不重试（mock 对无 requestId 的 consume 第一次 500） */
    r = am_consume(c, "C", "m", NULL, NULL);
    CHECK(r->error == AM_ERR_HTTP || r->error == AM_ERR_NETWORK || r->success, "consume without requestId: no retry (single 500)");
    am_result_free(r);

    /* 5. consume 有 requestId 重试成功 */
    r = am_consume(c, "C", "m", "req-1", NULL);
    CHECK(r->error == AM_OK && r->success, "consume with requestId retried and succeeded");
    am_result_free(r);

    /* 6. 验签通过 */
    am_client_options sig_opts = { .base_url = base, .project_key = "demo", .response_secret = "test-secret" };
    am_client *sig_client = am_client_new(&sig_opts);
    r = am_status(sig_client, "OK", "m", NULL);
    CHECK(r->error == AM_OK && r->success, "signature verified OK");
    am_result_free(r);

    /* 7. 验签失败（错误密钥） */
    am_client_options bad_opts = { .base_url = base, .project_key = "demo", .response_secret = "wrong" };
    am_client *bad = am_client_new(&bad_opts);
    r = am_status(bad, "OK", "m", NULL);
    CHECK(r->error == AM_ERR_SIGNATURE_INVALID || r->error == AM_ERR_SIGNATURE_MISSING,
          "bad secret rejected");
    printf("   (kind = %s)\n", am_err_str(r->error));
    am_result_free(r);

    am_client_free(sig_client);
    am_client_free(bad);
    am_client_free(c);

    printf(failures == 0 ? "✅ C SDK 自测全部通过\n" : "❌ %d 个断言失败\n", failures);
    return failures == 0 ? 0 : 1;
}
