// 16 语言 SDK 接入示例数据 —— 从 api-docs-ui.ts 拆出的纯数据模块

export type ApiLanguageSnippet = {
  key: string
  label: string
  description: string
  code: string
}

type TranslateLike = (key: string, fallback?: string) => string

export function buildLanguageSnippets(t?: TranslateLike): ApiLanguageSnippet[] {
  const tr = (key: string, fallback: string): string => t?.(key) ?? fallback

  return [
    {
      key: 'sdk',
      label: 'JavaScript / TypeScript SDK',
      description: tr(
        'apidocs.languageSnippets.sdk.description',
        '项目内已提供 src/lib/license-sdk.ts，最适合浏览器插件、桌面前端和 Node 环境快速接入。',
      ),
      code: String.raw`import { createLicenseClient, isLicenseClientError } from '@/lib/license-sdk'

const client = createLicenseClient({
  baseUrl: 'http://127.0.0.1:3000',
  projectKey: 'browser-plugin',
  timeoutMs: 10000,
  maxRetries: 1,
  retryDelayMs: 200,
})

const activateResult = await client.activate({
  code: 'A1B2C3D4E5F6G7H8',
  machineId: 'machine-001',
})

const statusResult = await client.status({
  code: 'A1B2C3D4E5F6G7H8',
  machineId: 'machine-001',
})

const consumeResult = await client.consume({
  code: 'A1B2C3D4E5F6G7H8',
  machineId: 'machine-001',
  requestId: 'req-001',
})

try {
  await client.consume({
    code: 'A1B2C3D4E5F6G7H8',
    machineId: 'machine-001',
    requestId: 'req-001',
  })
} catch (error) {
  if (isLicenseClientError(error)) {
    console.error(error.code, error.path, error.attemptCount)
  }
}`,
    },
    {
      key: 'python',
      label: 'Python requests',
      description: tr(
        'apidocs.languageSnippets.python.description',
        '适合桌面自动化脚本、内网工具或测试平台调试正式授权接口。',
      ),
      code: String.raw`import requests

BASE_URL = "http://127.0.0.1:3000"
COMMON_BODY = {
    "projectKey": "browser-plugin",
    "code": "A1B2C3D4E5F6G7H8",
    "machineId": "machine-001",
}

activate_resp = requests.post(f"{BASE_URL}/api/license/activate", json=COMMON_BODY, timeout=10)
print("activate", activate_resp.status_code, activate_resp.json())

status_resp = requests.post(f"{BASE_URL}/api/license/status", json=COMMON_BODY, timeout=10)
print("status", status_resp.status_code, status_resp.json())

consume_resp = requests.post(
    f"{BASE_URL}/api/license/consume",
    json={**COMMON_BODY, "requestId": "req-001"},
    timeout=10,
)
print("consume", consume_resp.status_code, consume_resp.json())

legacy_resp = requests.post(
    f"{BASE_URL}/api/verify",
    json={
        "project_key": "browser-plugin",
        "code": "A1B2C3D4E5F6G7H8",
        "machine_id": "machine-001",
    },
    timeout=10,
)
print("verify", legacy_resp.status_code, legacy_resp.json())`,
    },
    {
      key: 'sdk-go',
      label: 'Go SDK（sdk/go）',
      description: tr(
        'apidocs.languageSnippets.sdkGo.description',
        '标准库实现，复制 sdk/go/activationmanager.go 单文件即可使用。',
      ),
      code: String.raw`package main

import (
    "context"
    "fmt"
    "time"

    "activationmanager"
)

func main() {
    client := activationmanager.NewClient(activationmanager.ClientOptions{
        BaseURL:    "http://127.0.0.1:3000",
        ProjectKey: "browser-plugin",
        Timeout:    10 * time.Second,
        MaxRetries: 1,
    })

    result, err := client.Activate(context.Background(), "A1B2C3D4E5F6G7H8", "machine-001", nil)
    if err != nil {
        panic(err)
    }
    if !result.Success {
        fmt.Println("激活失败:", result.Message)
        return
    }
    fmt.Println("剩余次数:", result.RemainingCount)
}`,
    },
    {
      key: 'sdk-java',
      label: 'Java SDK（sdk/java）',
      description: tr(
        'apidocs.languageSnippets.sdkJava.description',
        'JVM 标准库实现（java.net.http + javax.crypto），复制 sdk/java 单模块引入。',
      ),
      code: String.raw`ActivationManagerClient.ClientOptions opts = new ActivationManagerClient.ClientOptions();
opts.baseUrl = "http://127.0.0.1:3000";
opts.projectKey = "browser-plugin";
opts.maxRetries = 1;

ActivationManagerClient client = new ActivationManagerClient(opts);

Result activate = client.activate("A1B2C3D4E5F6G7H8", "machine-001");
Result status = client.status("A1B2C3D4E5F6G7H8", "machine-001");
Result consume = client.consume("A1B2C3D4E5F6G7H8", "machine-001", "req-001");

if (!consume.isSuccess()) {
    System.out.println("消费失败: " + consume.getMessage());
}`,
    },
    {
      key: 'sdk-python',
      label: 'Python SDK（sdk/python）',
      description: tr(
        'apidocs.languageSnippets.sdkPython.description',
        'Python 3.8+ 标准库实现，比 requests 手拼更适合桌面工具集成。',
      ),
      code: String.raw`from activation_manager import create_client

client = create_client(
    base_url="http://127.0.0.1:3000",
    project_key="browser-plugin",
    max_retries=1,
)

result = client.activate(code="A1B2C3D4E5F6G7H8", machine_id="machine-001")
if not result["success"]:
    print("激活失败:", result["message"])

consume = client.consume(code="A1B2C3D4E5F6G7H8", machine_id="machine-001", request_id="req-001")
print("剩余次数:", consume["remainingCount"])`,
    },
    {
      key: 'sdk-csharp',
      label: 'C# SDK（sdk/csharp）',
      description: tr(
        'apidocs.languageSnippets.sdkCsharp.description',
        '.NET 标准库实现（System.Net.Http + System.Text.Json），适合 WPF/WinForms 桌面软件。',
      ),
      code: String.raw`using ActivationManager.Sdk;

var client = new ActivationManagerClient(
    new ActivationManagerClientOptions { BaseUrl = "http://127.0.0.1:3000", ProjectKey = "browser-plugin" });

var activate = await client.ActivateAsync("A1B2C3D4E5F6G7H8", "machine-001");
if (!activate.Success) Console.WriteLine("激活失败: " + activate.Message);

var consume = await client.ConsumeAsync("A1B2C3D4E5F6G7H8", "machine-001", projectKey: null, requestId: "req-001");
Console.WriteLine("剩余次数: " + consume.RemainingCount);`,
    },
    {
      key: 'sdk-php',
      label: 'PHP SDK（sdk/php）',
      description: tr(
        'apidocs.languageSnippets.sdkPhp.description',
        'PHP 8.1+ 标准库实现，适合桌面软件联机的 Web 后端或命令行工具。',
      ),
      code: String.raw`<?php
require 'src/ActivationManagerClient.php';

use ActivationManager\Sdk\ActivationManagerClient;

$client = new ActivationManagerClient([
    'baseUrl'    => 'http://127.0.0.1:3000',
    'projectKey' => 'browser-plugin',
    'maxRetries' => 1,
]);

$result = $client->activate('A1B2C3D4E5F6G7H8', 'machine-001');
if (!$result['success']) {
    echo '激活失败: ', $result['message'];
}

$consume = $client->consume('A1B2C3D4E5F6G7H8', 'machine-001', 'req-001');
echo '剩余次数: ', $consume['remainingCount'];`,
    },
    {
      key: 'sdk-ruby',
      label: 'Ruby SDK（sdk/ruby）',
      description: tr(
        'apidocs.languageSnippets.sdkRuby.description',
        'Ruby 3.0+ 标准库实现（net/http + openssl）。',
      ),
      code: String.raw`require_relative 'activation_manager_client'

client = ActivationManagerClient.new(
  base_url: 'http://127.0.0.1:3000',
  project_key: 'browser-plugin',
  max_retries: 1
)

result = client.activate(code: 'A1B2C3D4E5F6G7H8', machine_id: 'machine-001')
puts '激活失败: ' + result[:message].to_s unless result[:success]

consume = client.consume(code: 'A1B2C3D4E5F6G7H8', machine_id: 'machine-001', request_id: 'req-001')`,
    },
    {
      key: 'sdk-rust',
      label: 'Rust SDK（sdk/rust）',
      description: tr(
        'apidocs.languageSnippets.sdkRust.description',
        'reqwest(blocking, rustls) + serde_json 实现，适合 Rust 桌面与 CLI 工具。',
      ),
      code: String.raw`use activation_manager_sdk::{ActivationManagerClient, ClientOptions};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = ActivationManagerClient::new(ClientOptions {
        base_url: "http://127.0.0.1:3000".into(),
        project_key: "browser-plugin".into(),
        timeout_seconds: 10,
        max_retries: 1,
        ..Default::default()
    });

    let result = client.activate("A1B2C3D4E5F6G7H8", "machine-001", None)?;
    println!("剩余次数: {:?}", result.remaining_count);
    Ok(())
}`,
    },
    {
      key: 'sdk-kotlin',
      label: 'Kotlin SDK（sdk/kotlin）',
      description: tr(
        'apidocs.languageSnippets.sdkKotlin.description',
        'JVM 标准库实现，适合 Kotlin 桌面（Compose）与 Android 工具。',
      ),
      code: String.raw`val client = ActivationManagerClient(
    ActivationManagerClient.Options(
        baseUrl = "http://127.0.0.1:3000",
        projectKey = "browser-plugin",
        maxRetries = 1,
    )
)

val result = client.activate("A1B2C3D4E5F6G7H8", "machine-001")
if (!result.success) println("激活失败: " + result.message)

val consume = client.consume("A1B2C3D4E5F6G7H8", "machine-001", "req-001")
println("剩余次数: " + consume.remainingCount)`,
    },
    {
      key: 'sdk-swift',
      label: 'Swift SDK（sdk/swift）',
      description: tr(
        'apidocs.languageSnippets.sdkSwift.description',
        'Swift 5.9+ async/await 实现，适合 macOS 工具与 iOS 客户端。',
      ),
      code: String.raw`let client = try ActivationManagerClient(
    baseURL: "http://127.0.0.1:3000",
    projectKey: "browser-plugin",
    maxRetries: 1
)

let activate = try await client.activate(code: "A1B2C3D4E5F6G7H8", machineId: "machine-001")
print("剩余次数: " + (activate.remainingCount?.description ?? "-"))

let consume = try await client.consume(code: "A1B2C3D4E5F6G7H8", machineId: "machine-001", requestId: "req-001")`,
    },
    {
      key: 'sdk-dart',
      label: 'Dart SDK（sdk/dart）',
      description: tr(
        'apidocs.languageSnippets.sdkDart.description',
        'Dart 实现（package:http + crypto），适合 Flutter 跨平台客户端。',
      ),
      code: String.raw`final client = ActivationManagerClient(
  baseUrl: 'http://127.0.0.1:3000',
  projectKey: 'browser-plugin',
);

final result = await client.activate('A1B2C3D4E5F6G7H8', 'machine-001');
if (!result.success) print('激活失败: ' + result.message!);

final consume = await client.consume('A1B2C3D4E5F6G7H8', 'machine-001', requestId: 'req-001');`,
    },
    {
      key: 'sdk-c',
      label: 'C SDK（sdk/c，libcurl）',
      description: tr(
        'apidocs.languageSnippets.sdkC.description',
        'C11 + libcurl + OpenSSL 实现，适合嵌入式与原生插件。',
      ),
      code: String.raw`#include "activation_manager.h"

am_client *c = am_client_new(&(am_client_options){
    .base_url = "http://127.0.0.1:3000",
    .project_key = "browser-plugin",
    .timeout_ms = 10000,
    .max_retries = 1,
});

am_result *r = am_activate(c, "A1B2C3D4E5F6G7H8", "machine-001", NULL);
if (!r->success) printf("激活失败: %s\n", r->message);
am_result_free(r);
am_client_free(c);`,
    },
    {
      key: 'sdk-cpp',
      label: 'C++ SDK（sdk/cpp）',
      description: tr(
        'apidocs.languageSnippets.sdkCpp.description',
        'C++17 实现（activation_manager::client），适合原生桌面插件。',
      ),
      code: String.raw`#include "activation_manager.hpp"

activation_manager::client client({.base_url = "http://127.0.0.1:3000", .project_key = "browser-plugin"});

auto r = client.activate("A1B2C3D4E5F6G7H8", "machine-001");
if (!r.success) std::cerr << "激活失败\n";

auto r2 = client.consume("A1B2C3D4E5F6G7H8", "machine-001", "req-001");`,
    },
    {
      key: 'sdk-scala',
      label: 'Scala SDK（sdk/scala）',
      description: tr(
        'apidocs.languageSnippets.sdkScala.description',
        'JVM 标准库实现，与 Java SDK 同源。',
      ),
      code: String.raw`val client = ActivationManagerClient(ActivationManagerClient.Options(
  baseUrl = "http://127.0.0.1:3000", projectKey = "browser-plugin"))

val result = client.activate("A1B2C3D4E5F6G7H8", "machine-001")
if (!result.success) println(s"激活失败: " + result.message)`,
    },
    {
      key: 'sdk-groovy',
      label: 'Groovy SDK（sdk/groovy）',
      description: tr(
        'apidocs.languageSnippets.sdkGroovy.description',
        'JVM 标准库实现（JsonSlurper + javax.crypto）。',
      ),
      code: String.raw`def client = new ActivationManagerClient(baseUrl: 'http://127.0.0.1:3000', projectKey: 'browser-plugin')

def result = client.activate('A1B2C3D4E5F6G7H8', 'machine-001')
if (!result.success) println "激活失败: " + result.message

def consume = client.consume('A1B2C3D4E5F6G7H8', 'machine-001', 'req-001')`,
    },
    {
      key: 'sdk-lua',
      label: 'Lua SDK（sdk/lua）',
      description: tr(
        'apidocs.languageSnippets.sdkLua.description',
        'LuaSocket + dkjson 实现，适合游戏脚本与嵌入式扩展。',
      ),
      code: String.raw`local ActivationManager = require("activation_manager")

local client = ActivationManager.new({ base_url = "http://127.0.0.1:3000", project_key = "browser-plugin" })
local result = client:activate("A1B2C3D4E5F6G7H8", "machine-001")
if not result.success then print("激活失败:", result.message) end

local consume = client:consume("A1B2C3D4E5F6G7H8", "machine-001", "req-001")`,
    },
    {
      key: 'sdk-perl',
      label: 'Perl SDK（sdk/perl）',
      description: tr(
        'apidocs.languageSnippets.sdkPerl.description',
        'Perl 5 标准库实现（HTTP::Tiny + Digest::SHA + JSON::PP）。',
      ),
      code: String.raw`use ActivationManager;

my $client = ActivationManager->new(
    base_url => 'http://127.0.0.1:3000', project_key => 'browser-plugin');
my $result = $client->activate('A1B2C3D4E5F6G7H8', 'machine-001');
print "激活失败: $result->{message}\n" unless $result->{success};

my $consume = $client->consume('A1B2C3D4E5F6G7H8', 'machine-001', 'req-001');`,
    },

    {
      key: 'curl',
      label: tr('apidocs.languageSnippets.curl.label', 'cURL / Postman 参考'),
      description: tr(
        'apidocs.languageSnippets.curl.description',
        '适合联调、写 Postman collection、或快速把请求复制给后端和测试同学复现。',
      ),
      code: String.raw`# activate
curl -X POST "http://127.0.0.1:3000/api/license/activate" \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "browser-plugin",
    "code": "A1B2C3D4E5F6G7H8",
    "machineId": "machine-001"
  }'

# status
curl -X POST "http://127.0.0.1:3000/api/license/status" \
  -H "Content-Type: application/json" \
  -d '{
    "project_key": "browser-plugin",
    "code": "A1B2C3D4E5F6G7H8",
    "machine_id": "machine-001"
  }'

# consume
curl -X POST "http://127.0.0.1:3000/api/license/consume" \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "browser-plugin",
    "code": "A1B2C3D4E5F6G7H8",
    "machineId": "machine-001",
    "requestId": "req-001"
  }'

# legacy verify
curl -X POST "http://127.0.0.1:3000/api/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "project_key": "browser-plugin",
    "code": "A1B2C3D4E5F6G7H8",
    "machine_id": "machine-001"
  }'`,
    },
  ]
}
