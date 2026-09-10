# Multi-Language SDKs

与 JS/TS SDK（`src/lib/license-sdk.ts`）等价的多语言客户端实现。全部为**单文件 / 零第三方依赖**，只调用同一套 License API：

- `POST /api/license/activate` — 激活（绑定设备；TIME 型首次激活起算有效期；COUNT 型不扣次数）
- `POST /api/license/status` — 查询状态（剩余次数 / 过期时间 / 是否已绑定）
- `POST /api/license/consume` — 消费（COUNT 型扣减 1 次，`requestId` 幂等；TIME 型仅校验）

> `/api/verify` 兼容接口不在 SDK 提供（旧插件专用）。

## 共同约定

- **统一 camelCase 请求**；响应双字段（camelCase / snake_case）取值自动归一
- **可选 projectKey 默认值**，单次调用可覆盖
- **超时 / 重试**：仅瞬时网络错误重试；`consume` 仅在传了 `requestId` 时允许重试（防重复扣次）
- **可选响应验签**：服务端配置 `licenseResponseSecret` 后开启——HMAC-SHA256(body, secret) + `x-license-timestamp` 5 分钟时间窗，客户端校验失败抛专用异常
- **错误分类对齐**：`NETWORK_ERROR` / `TIMEOUT` / `INVALID_RESPONSE` / `HTTP_ERROR` / `SIGNATURE_*`

## 各语言

| 语言 | 入口 | 运行要求 | 自测 |
|---|---|---|---|
| Python | [`sdk/python/activation_manager.py`](../python/activation_manager.py) | Python 3.8+ 标准库 | `python3 sdk/python/test_sdk.py` |
| Go | [`sdk/go/activationmanager.go`](../go/activationmanager.go)（package `activationmanager`） | Go 1.21+ 标准库 | `cd sdk/go && go test ./...` |
| Java | [`sdk/java/.../ActivationManagerClient.java`](../java/activation-manager/src/main/java/com/activationmanager/sdk/ActivationManagerClient.java) | Java 17+ 标准库；Maven 构建（测试用 JUnit 5） | `cd sdk/java/activation-manager && mvn test` |
| PHP | [`sdk/php/src/ActivationManagerClient.php`](../php/src/ActivationManagerClient.php) | PHP 7.4+（curl/hash/json 扩展） | `php sdk/php/test_sdk.php`（需本机 8931 端口可用） |
| Ruby | [`sdk/ruby/activation_manager_client.rb`](../ruby/activation_manager_client.rb) | Ruby 3.0+ 标准库 | `ruby sdk/ruby/test_sdk.rb` |
| C | [`sdk/c/activation_manager.h`](../c/activation_manager.h) + `.c` | C11 + libcurl + OpenSSL（验签需 `-DAM_HAVE_OPENSSL`） | 见下方 C 章节 |
| C++ | [`sdk/cpp/activation_manager.hpp`](../cpp/activation_manager.hpp)（header-only） | C++17 + libcurl + OpenSSL（验签需 `-DAM_HAVE_OPENSSL`） | 见下方 C++ 章节 |
| TypeScript | [`sdk/typescript/license-sdk.ts`](../typescript/license-sdk.ts)（源码在 `src/lib/license-sdk.ts`，副本同步维护） | TS 5+ / Node 18+ | `npx tsc --noEmit -p sdk/typescript` |
| Swift | [`sdk/swift/Sources`](../swift)（SPM 包） | Swift 5.9+（macOS 12+ / Linux），依赖 swift-crypto | `cd sdk/swift && swift build && swift test` |
| Dart | [`sdk/dart/lib/activation_manager.dart`](../dart/lib/activation_manager.dart) | Dart 3+，依赖 http/crypto | `cd sdk/dart && dart pub get && dart test` |
| Scala | [`sdk/scala/ActivationManager.scala`](../scala/ActivationManager.scala) | Scala 3.3 / JVM 17，零第三方依赖 | `cd sdk/scala && ./scala-cli run test_sdk.scala` |
| Perl | [`sdk/perl/ActivationManager.pm`](../perl/ActivationManager.pm) | Perl 5.14+（核心模块 HTTP::Tiny/JSON::PP/Digest::SHA） | `cd sdk/perl && perl test_sdk.pl` |
| Lua | [`sdk/lua/activation_manager.lua`](../lua/activation_manager.lua) | Lua 5.4 + luarocks（luasocket/dkjson） | `cd sdk/lua && lua -e "require('activation_manager')" |` |
| Groovy | [`sdk/groovy/ActivationManagerClient.groovy`](../groovy/ActivationManagerClient.groovy) | Groovy 4 / JVM 17，零第三方依赖 | `cd sdk/groovy && groovyc ActivationManagerClient.groovy` |

### C

```bash
cd sdk/c
python3 test_server.py 18971 &        # 本地 mock 服务
cc -std=c11 -DAM_HAVE_OPENSSL -c activation_manager.c -I<openssl-include> -o am.o
cc -std=c11 -DAM_HAVE_OPENSSL test_client.c am.o -I<openssl-include> -L<openssl-lib> -lssl -lcrypto -lcurl -o test_client
./test_client "http://127.0.0.1:18971"
```

```c
am_client *c = am_client_new(&(am_client_options){.base_url = "http://127.0.0.1:3000", .project_key = "browser-plugin"});
am_result *r = am_activate(c, "A1B2C3D4E5F6G7H8", "machine-001", NULL);
if (!r->success) printf("激活失败: %s\n", r->message);
am_result_free(r);
am_client_free(c);
```

### C++

```bash
cd sdk/cpp
python3 ../c/test_server.py 18975 &
c++ -std=c++17 -DAM_HAVE_OPENSSL test_client.cpp -I<openssl-include> -L<openssl-lib> -lssl -lcrypto -lcurl -o test_client
./test_client "http://127.0.0.1:18975"
```

```cpp
activation_manager::client client({.base_url = "http://127.0.0.1:3000", .project_key = "browser-plugin"});
auto result = client.activate("A1B2C3D4E5F6G7H8", "machine-001");
if (!result.success) std::cout << "激活失败: " << result.message << "\n";
```

各文件头部 docstring / 注释含完整用法示例。

## 快速示例

### Python

```python
from activation_manager import create_client

client = create_client(base_url="http://127.0.0.1:3000", project_key="browser-plugin")
result = client.activate(code="A1B2C3D4E5F6G7H8", machine_id="machine-001")
if not result["success"]:
    print("激活失败:", result["message"])
```

### Go

```go
client := activationmanager.NewClient(activationmanager.ClientOptions{
    BaseURL: "http://127.0.0.1:3000", ProjectKey: "browser-plugin",
})
result, err := client.Activate(ctx, "A1B2C3D4E5F6G7H8", "machine-001", nil)
if err != nil { log.Fatal(err) }
if !result.Success { fmt.Println("激活失败:", result.Message) }
```

### Java

```java
var opts = new ActivationManagerClient.ClientOptions();
opts.baseUrl = "http://127.0.0.1:3000";
opts.projectKey = "browser-plugin";
var client = new ActivationManagerClient(opts);

var result = client.activate("A1B2C3D4E5F6G7H8", "machine-001");
if (!result.isSuccess()) System.out.println("激活失败: " + result.getMessage());
```

### PHP

```php
$client = new ActivationManagerClient([
    'baseUrl' => 'http://127.0.0.1:3000', 'projectKey' => 'browser-plugin',
]);
$result = $client->activate('A1B2C3D4E5F6G7H8', 'machine-001');
if (!$result['success']) echo '激活失败: ', $result['message'];
```

### Ruby

```ruby
client = ActivationManagerClient.new(base_url: 'http://127.0.0.1:3000', project_key: 'browser-plugin')
result = client.activate(code: 'A1B2C3D4E5F6G7H8', machine_id: 'machine-001')
puts "激活失败: #{result['message']}" unless result['success']
```

## 语言选择建议

- **脚本 / 数据处理** → Python
- **后端服务 / CLI 工具** → Go
- **企业 JVM 环境** → Java
- **传统 Web 主机** → PHP
- **运维脚本 / DevOps** → Ruby
- **桌面软件 / 嵌入式 / 系统集成** → C 或 C++（发行单个可执行文件、无运行时依赖时首选）
- **Apple 生态（macOS/iOS）** → Swift
- **Flutter 跨端移动应用** → Dart
- **Spark / 大数据 JVM 团队** → Scala 或 Groovy

## 覆盖说明

全部 17 语言均通过 GitHub Actions 验证（`.github/workflows/sdk-tests.yml`，10+ job 矩阵）。
历史边界说明：C#（.NET）、Rust、Kotlin 曾因本机无工具链未随附——后按用户要求补齐，由 GitHub CI 完成验证。
JS/TS 源码维护在 `src/lib/license-sdk.ts`（仓库主代码引用它），`sdk/typescript/` 为独立副本方便 SDK 用户复制。
