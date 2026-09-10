// activation_manager.hpp 自测
#include "activation_manager.hpp"
#include <cassert>
#include <iostream>
#include <string>

static int failures = 0;
#define CHECK(cond, msg) do { if (cond) { std::cout << "✅ " msg "\n"; } else { std::cout << "❌ " msg " (line " << __LINE__ << ")\n"; ++failures; } } while (0)

int main(int argc, char** argv) {
    if (argc < 2) { std::cerr << "usage: " << argv[0] << " <base_url>\n"; return 1; }
    std::string base = argv[1];

    // 1. activate 成功 + 双字段归一
    activation_manager::client client({.base_url = base, .project_key = "demo"});
    auto r = client.activate("CODE-1", "m-1");
    CHECK(r.success, "activate success");
    CHECK(r.license_mode == "COUNT", "licenseMode normalized");
    CHECK(r.remaining_count.has_value() && *r.remaining_count == 9, "remainingCount = 9");

    // 2. projectKey 覆盖
    auto r2 = client.activate("CODE-2", "m-2", "override");
    CHECK(r2.success, "projectKey override accepted");

    // 3. 业务失败透传
    auto r3 = client.status("BAD", "m-1");
    CHECK(!r3.success, "business failure: success=false");
    CHECK(!r3.message.empty(), "business failure message extracted");

    // 4. consume 无 requestId 不重试
    try {
        client.consume("C", "m", "", "");
        CHECK(false, "consume without requestId should throw on 500");
    } catch (const activation_manager::client_exception& e) {
        CHECK(e.kind() == activation_manager::error_kind::http_error && e.attempt_count() == 1,
              "consume without requestId: no retry");
    }

    // 5. consume 有 requestId 重试成功
    auto r5 = client.consume("C", "m", "req-1", "");
    CHECK(r5.success, "consume with requestId retried and succeeded");

    // 6. 验签通过
    activation_manager::client sig_client({.base_url = base, .project_key = "demo", .response_secret = "test-secret"});
    auto r6 = sig_client.status("OK", "m");
    CHECK(r6.success, "signature verified OK");

    // 7. 验签失败
    activation_manager::client bad({.base_url = base, .project_key = "demo", .response_secret = "wrong"});
    try {
        bad.status("OK", "m");
        CHECK(false, "bad secret should throw");
    } catch (const activation_manager::client_exception& e) {
        CHECK(e.kind() == activation_manager::error_kind::signature_invalid, "bad secret rejected");
    }

    std::cout << (failures == 0 ? "✅ C++ SDK 自测全部通过" : "❌ " + std::to_string(failures) + " 个断言失败") << "\n";
    return failures == 0 ? 0 : 1;
}
